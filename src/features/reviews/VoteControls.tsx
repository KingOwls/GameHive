import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import type { PublicReview, ReviewVote } from "../../domain/models";
import {
  createReviewVotesService,
  VoteError,
  type ReviewVotesService,
} from "../../services/review-votes";
import { publicError } from "../../services/errors";
import { useAuth } from "../auth/AuthContext";
const defaultService = createReviewVotesService();
type VoteState = {
  row: ReviewVote;
  status: "loading" | "ready" | "busy" | "error";
  message?: string;
};
const VotesContext = createContext<{
  states: Record<string, VoteState>;
  submit: (id: string, value: 1 | -1) => void;
  retry: () => void;
} | null>(null);
export function ReviewVotesProvider({
  reviews,
  children,
  service = defaultService,
}: {
  reviews: PublicReview[];
  children: ReactNode;
  service?: ReviewVotesService;
}) {
  const { session } = useAuth();
  const actor = session?.user.id;
  const ids = reviews.map((r) => r.id).join(",");
  const snapshot = reviews
    .map((r) => `${r.id}:${r.version}:${r.helpful_count}:${r.unhelpful_count}`)
    .join(",");
  const [attempt, setAttempt] = useState(0);
  const [states, setStates] = useState<Record<string, VoteState>>({});
  const locked = useRef(new Set<string>());
  const active = useRef(true);
  const generations = useRef<Record<string, number>>({});
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!actor || !ids) return;
    const controller = new AbortController();
    const requested = ids.split(",");
    const observed = Object.fromEntries(
      requested.map((id) => [id, generations.current[id] ?? 0]),
    );
    setStates((previous) =>
      Object.fromEntries(
        requested.map((id) => [
          id,
          {
            row: previous[id]?.row ?? {
              reviewId: id,
              value: null,
              helpfulCount: null,
              unhelpfulCount: null,
            },
            status: locked.current.has(id) ? "busy" : "loading",
          },
        ]),
      ),
    );
    service
      .own(requested, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted)
          setStates((previous) =>
            Object.fromEntries(
              rows.map((row) => [
                row.reviewId,
                locked.current.has(row.reviewId) ||
                (generations.current[row.reviewId] ?? 0) !==
                  observed[row.reviewId]
                  ? previous[row.reviewId]
                  : { row, status: "ready" },
              ]),
            ),
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setStates((previous) =>
            Object.fromEntries(
              requested.map((id) => [
                id,
                locked.current.has(id) ||
                (generations.current[id] ?? 0) !== observed[id]
                  ? previous[id]
                  : {
                      ...previous[id],
                      status: "error",
                      message: publicError(error),
                    },
              ]),
            ),
          );
      });
    return () => controller.abort();
  }, [actor, ids, snapshot, service, attempt]);
  const retry = () => {
    if (!locked.current.size) setAttempt((n) => n + 1);
  };
  const submit = async (id: string, value: 1 | -1) => {
    if (
      locked.current.has(id) ||
      states[id]?.status !== "ready" ||
      states[id].row.value !== null
    )
      return;
    locked.current.add(id);
    generations.current[id] = (generations.current[id] ?? 0) + 1;
    setStates((previous) => ({
      ...previous,
      [id]: { ...previous[id], status: "busy", message: undefined },
    }));
    try {
      const row = await service.vote(id, value);
      if (active.current)
        setStates((previous) => ({
          ...previous,
          [id]: { row, status: "ready" },
        }));
    } catch (error) {
      if (!active.current) return;
      // Never enable a second write until an authoritative own read has completed.
      setStates((previous) => ({
        ...previous,
        [id]: { ...previous[id], status: "error", message: publicError(error) },
      }));
      if (
        error instanceof VoteError &&
        (error.status === 409 || error.status >= 500)
      ) {
        try {
          const [row] = await service.own([id]);
          if (active.current)
            setStates((previous) => ({
              ...previous,
              [id]: {
                row,
                status: "ready",
                message:
                  row.value === null
                    ? "No hay voto guardado. Puedes intentarlo de nuevo."
                    : "Voto guardado comprobado.",
              },
            }));
        } catch {
          // Explicit retry repeats the own query, never the mutation.
        }
      }
    } finally {
      generations.current[id] = (generations.current[id] ?? 0) + 1;
      locked.current.delete(id);
    }
  };
  return (
    <VotesContext.Provider
      value={{
        states,
        submit: (id, value) => {
          void submit(id, value);
        },
        retry,
      }}
    >
      {children}
    </VotesContext.Provider>
  );
}
export function VoteControls({ review }: { review: PublicReview }) {
  const { session } = useAuth();
  const context = useContext(VotesContext);
  const state = context?.states[review.id];
  const row = state?.row;
  const own = session?.user.id === review.author_id;
  const ready = state?.status === "ready";
  const counted = row?.helpfulCount !== null && row?.helpfulCount !== undefined;
  return (
    <div className="vote-controls" aria-label="Votos de utilidad">
      <p>
        Útiles: {counted ? row.helpfulCount : (review.helpful_count ?? 0)} · No
        útiles: {counted ? row.unhelpfulCount : (review.unhelpful_count ?? 0)}
      </p>
      {!session ? (
        <p>
          <Link to="/login">Inicia sesión para votar</Link>.
        </p>
      ) : own ? (
        <p>No puedes votar tu propia reseña.</p>
      ) : (
        <>
          {state?.status === "loading" && (
            <p role="status">Comprobando tu voto…</p>
          )}
          {row?.value !== null && row?.value !== undefined ? (
            <p role="status">
              Tu voto irreversible: {row.value === 1 ? "útil" : "no útil"}. No
              puedes cambiarlo ni retirarlo.
            </p>
          ) : (
            <>
              <p>
                Tu voto es irreversible: solo puedes votar una vez y no podrás
                cambiarlo ni retirarlo.
              </p>
              <button
                type="button"
                disabled={!ready || !counted}
                onClick={() => context?.submit(review.id, 1)}
              >
                Votar útil
              </button>{" "}
              <button
                type="button"
                disabled={!ready || !counted}
                onClick={() => context?.submit(review.id, -1)}
              >
                Votar no útil
              </button>
            </>
          )}
          {state?.status === "busy" && <p role="status">Guardando voto…</p>}
          {state?.message && (
            <p role={state.status === "error" ? "alert" : "status"}>
              {state.message}
            </p>
          )}
          {state?.status === "error" && (
            <button type="button" onClick={() => context?.retry()}>
              Comprobar voto guardado
            </button>
          )}
        </>
      )}
    </div>
  );
}
