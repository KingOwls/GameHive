import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type {
  CriticalOptions,
  Identity,
  Page,
  PublicReview,
  Review,
  ReviewAction,
  ReviewInput,
  Resource,
} from "../../domain/models";
import { criticalMean, validateReview } from "../../domain/rules";
import {
  createReviewsService,
  ReviewError,
  persistedReviewGame,
  reviewInput,
  type ReviewsService,
} from "../../services/reviews";
import { publicError } from "../../services/errors";
import { useAuth } from "../auth/AuthContext";
import { SpoilerReveal } from "../../components/SpoilerReveal";
import {
  CriticalAnalysis,
  CriticalEditor,
  emptyCritical,
} from "./CriticalAnalysis";
import {
  readReviewDraft,
  reconcileCriticalQuestions,
  type ReviewDraft as Draft,
} from "./reviewDraft";
const defaultService = createReviewsService();
const empty: ReviewInput = {
  rating: 5,
  title: "",
  bodyPublic: "",
  bodySpoiler: "",
  pros: [],
  cons: [],
};
function syncTextValidity(
  control: HTMLInputElement | HTMLTextAreaElement | null,
  max: number,
) {
  control?.setCustomValidity(
    control && [...control.value].length > max
      ? `Usa como máximo ${max} caracteres.`
      : "",
  );
}
export function ReviewsSection({
  gameId,
  service = defaultService,
}: {
  gameId: string;
  service?: ReviewsService;
}) {
  const { session } = useAuth();
  if (!persistedReviewGame(gameId))
    return (
      <p>
        Las reseñas persistentes requieren una ficha real de RAWG o del catálogo
        manual.
      </p>
    );
  return (
    <ReviewsContent
      key={`${gameId}:${session?.user.id ?? "guest"}`}
      gameId={gameId}
      service={service}
    />
  );
}
function ReviewsContent({
  gameId,
  service,
}: {
  gameId: string;
  service: ReviewsService;
}) {
  const auth = useAuth();
  const actor = auth.session?.user.id;
  const storageKey = `gamehive:review-draft:${actor}:${gameId}`;
  const [savedDraft] = useState(() =>
    actor ? readReviewDraft(storageKey) : null,
  );
  const initialized = useRef(!!savedDraft);
  const [draft, setDraft] = useState<Draft>(
    savedDraft ?? { input: { ...empty }, version: null, baseline: undefined },
  );
  const [criticalOptions, setCriticalOptions] = useState<CriticalOptions>({
    questions: [],
    platforms: [],
  });
  const [questionsState, setQuestionsState] = useState<
    Resource<CriticalOptions>
  >({ status: "loading" });
  const [questionsAttempt, setQuestionsAttempt] = useState(0);
  const [own, setOwn] = useState<Review | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ownerReady, setOwnerReady] = useState(false);
  const [ownerAttempt, setOwnerAttempt] = useState(0);
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<Resource<Page<PublicReview>>>({
    status: "loading",
  });
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    service
      .list(gameId, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setList({ status: "success", data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setList({ status: "error", message: publicError(error) });
      });
    return () => controller.abort();
  }, [gameId, service, page, attempt]);
  useEffect(() => {
    if (!actor || !auth.service) return;
    let active = true;
    const controller = new AbortController();
    Promise.all([
      auth.service.identity(),
      service.own(gameId, controller.signal),
    ])
      .then(([nextIdentity, review]) => {
        if (!active) return;
        setIdentity(nextIdentity);
        setOwn(review);
        setOwnerReady(true);
        // Restoring a draft retains its original version even after a browser refresh.
        if (!initialized.current) {
          initialized.current = true;
          setDraft({
            input: review ? reviewInput(review) : { ...empty },
            version: review?.version ?? null,
            baseline: review ? reviewInput(review) : undefined,
            questions: review?.critical?.answers.map((a) => a.question),
          });
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(publicError(error));
          setOwnerReady(true);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [actor, auth.service, gameId, service, savedDraft, ownerAttempt]);
  useEffect(() => {
    if (identity?.role !== "critic" || !service.questions) return;
    const controller = new AbortController();
    service
      .questions(gameId, controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return;
        setCriticalOptions(options);
        setQuestionsState({ status: "success", data: options });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setQuestionsState({ status: "error", message: publicError(error) });
      });
    return () => controller.abort();
  }, [identity?.role, service, gameId, questionsAttempt]);
  const store = (next: Draft) => {
    setDraft(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setMessage("El navegador no pudo conservar el borrador al recargar.");
    }
  };
  const change = (patch: Partial<ReviewInput>) => {
    if (!busy) store({ ...draft, input: { ...draft.input, ...patch } });
  };
  const textChange = (
    field: "title" | "bodyPublic" | "bodySpoiler",
    control: HTMLInputElement | HTMLTextAreaElement,
    max: number,
  ) => {
    syncTextValidity(control, max);
    change({ [field]: control.value });
  };
  const clearDenied = (error: unknown) => {
    if (error instanceof ReviewError && [401, 403].includes(error.status))
      setIdentity(null);
  };
  const reload = async (replace: boolean) => {
    setBusy(true);
    setIdentity(null);
    setList({ status: "loading" });
    try {
      const [currentIdentity, currentOwn, currentList] =
        await Promise.allSettled([
          auth.service!.identity(),
          service.own(gameId),
          service.list(gameId, page),
        ]);
      if (currentList.status === "fulfilled")
        setList({ status: "success", data: currentList.value });
      else
        setList({ status: "error", message: publicError(currentList.reason) });
      if (currentIdentity.status === "rejected") throw currentIdentity.reason;
      if (currentOwn.status === "rejected") throw currentOwn.reason;
      setIdentity(currentIdentity.value);
      const review = currentOwn.value;
      setOwn(review);
      setUncertain(false);
      setQuestionsState({ status: "loading" });
      setQuestionsAttempt((n) => n + 1);
      if (replace) {
        const next = {
          input: review ? reviewInput(review) : { ...empty },
          version: review?.version ?? null,
          baseline: review ? reviewInput(review) : undefined,
          questions: review?.critical?.answers.map((a) => a.question),
        };
        setDraft(next);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Storage unavailable. */
        }
        setMessage("Versión guardada cargada.");
      } else
        setMessage(
          review
            ? `Reseña guardada: versión ${review.version}, ${review.status === "published" ? "publicada" : review.status === "withdrawn" ? "retirada" : "oculta por moderación"}. Tu borrador se conserva.`
            : "No existe una reseña propia guardada. Tu borrador se conserva.",
        );
    } catch (error) {
      clearDenied(error);
      setMessage(publicError(error));
    } finally {
      setBusy(false);
    }
  };
  const preparingCritical = !!draft.input.critical && own?.kind !== "critic";
  const staleQuestions =
    preparingCritical &&
    questionsState.status === "success" &&
    JSON.stringify(
      draft.input.critical!.answers.map((a) => a.questionId).sort(),
    ) !== JSON.stringify(criticalOptions.questions.map((q) => q.id).sort());
  const invalidPlatform =
    !!draft.input.critical &&
    identity?.role === "critic" &&
    questionsState.status === "success" &&
    !criticalOptions.platforms.includes(draft.input.critical.platform) &&
    !(
      own?.kind === "critic" &&
      own.critical?.platform === draft.input.critical.platform
    );
  const submissionBlock =
    preparingCritical && identity?.role !== "critic"
      ? "Cancela explícitamente la preparación crítica antes de publicar o guardar una reseña ordinaria con tu rol actual."
      : staleQuestions
        ? "Actualiza las preguntas conservando respuestas antes de publicar este análisis. Tu borrador se conserva."
        : invalidPlatform
          ? "La plataforma seleccionada ya no está en el catálogo. Elige una plataforma actual antes de guardar el análisis."
          : "";
  const submit = async (action: ReviewAction) => {
    if (uncertain || busy) return;
    if (preparingCritical && identity?.role !== "critic") {
      setMessage(submissionBlock);
      return;
    }
    if (action === "create" || action === "update" || action === "convert") {
      if (submissionBlock) {
        setMessage(submissionBlock);
        return;
      }
      const checking = {
        ...draft.input,
        rating:
          draft.input.critical && identity?.role === "critic"
            ? criticalMean(draft.input.critical.criteria)
            : draft.input.rating,
      };
      const errors = validateReview(checking, draft.baseline);
      if (errors.length) {
        setMessage(errors.join(" "));
        return;
      }
    }
    setBusy(true);
    setMessage("");
    try {
      const review = await service.mutate(
        action,
        gameId,
        draft.version,
        action === "create" || action === "update" || action === "convert"
          ? (() => {
              const input = { ...draft.input };
              if (identity?.role !== "critic") {
                delete input.critical;
                if (own?.kind === "critic") input.rating = own.rating;
              } else if (input.critical)
                input.rating = criticalMean(input.critical.criteria);
              return input;
            })()
          : undefined,
      );
      setOwn(review);
      const input = reviewInput(review);
      if (action === "withdraw" || action === "republish") {
        store({ ...draft, version: review.version, baseline: input });
      } else {
        setDraft({
          input,
          version: review.version,
          baseline: input,
          questions: review.critical?.answers.map((a) => a.question),
        });
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Storage unavailable. */
        }
      }
      setMessage("Reseña guardada.");
      setAttempt((n) => n + 1);
    } catch (error) {
      if (
        error instanceof ReviewError &&
        error.status >= 500 &&
        error.status <= 599
      )
        setUncertain(true);
      clearDenied(error);
      setMessage(publicError(error));
    } finally {
      setBusy(false);
    }
  };
  const form = (event: FormEvent) => {
    event.preventDefault();
    void submit(
      draft.version === null
        ? "create"
        : own?.kind !== "critic" && draft.input.critical
          ? "convert"
          : "update",
    );
  };
  const canWrite =
    (identity?.role === "user" || identity?.role === "critic") &&
    identity.status === "active" &&
    own?.status !== "hidden";
  return (
    <section aria-labelledby="reviews-heading" className="reviews-section">
      <h2 id="reviews-heading">Reseñas de la comunidad</h2>
      {list.status === "loading" && <p role="status">Cargando reseñas…</p>}
      {list.status === "error" && (
        <>
          <p role="alert">{list.message}</p>
          <button
            onClick={() => {
              setList({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar reseñas
          </button>
        </>
      )}
      {list.status === "success" && (
        <>
          <p>
            {list.data.total
              ? `${list.data.total} reseña${list.data.total === 1 ? "" : "s"} publicada${list.data.total === 1 ? "" : "s"} · Cálculo de puntuación GameHive pendiente`
              : "Sin evaluaciones GameHive"}
          </p>
          {list.data.items.map((review) => (
            <article
              key={`${review.id}:${review.version}`}
              className="review-card"
            >
              <p>
                <span
                  role="img"
                  aria-label={`Avatar ${review.profiles.avatar_key}`}
                >
                  {
                    ({ hive: "⬡", orbit: "◎", spark: "✦" } as const)[
                      review.profiles.avatar_key
                    ]
                  }
                </span>{" "}
                {review.profiles.username}
              </p>
              <h3>{review.title}</h3>
              {review.kind === "critic" && (
                <p>
                  Análisis crítico ·{" "}
                  {review.critic_verified
                    ? "Crítico verificado"
                    : "Sin verificación de crítico"}
                </p>
              )}
              <p>
                Nota del autor: {review.rating} / 10 ·{" "}
                <time dateTime={review.updated_at}>
                  {new Date(review.updated_at).toLocaleDateString("es")}
                </time>
              </p>
              <p className="game-description">{review.body_public}</p>
              {!!review.pros.length && <p>Pros: {review.pros.join(" · ")}</p>}
              {!!review.cons.length && (
                <p>Contras: {review.cons.join(" · ")}</p>
              )}
              {review.critical && (
                <CriticalAnalysis details={review.critical} />
              )}
              {review.body_spoiler && (
                <SpoilerReveal key={review.id} text={review.body_spoiler} />
              )}
            </article>
          ))}
          {(list.data.total > 10 || page > 1) && (
            <nav aria-label="Páginas de reseñas">
              <button
                disabled={page === 1}
                onClick={() => {
                  setList({ status: "loading" });
                  setPage((n) => n - 1);
                }}
              >
                Reseñas anteriores
              </button>
              <span> Página {page} </span>
              <button
                disabled={
                  !Number.isSafeInteger(page * 10) ||
                  page * 10 >= list.data.total
                }
                onClick={() => {
                  setList({ status: "loading" });
                  setPage((n) => n + 1);
                }}
              >
                Reseñas siguientes
              </button>
            </nav>
          )}
        </>
      )}
      {!actor ? (
        <p>
          <Link to="/login">Inicia sesión</Link> para publicar tu reseña.
        </p>
      ) : (
        <>
          {!ownerReady && (
            <p role="status">Comprobando tu reseña y permisos…</p>
          )}
          {ownerReady && identity && !canWrite && (
            <p>
              {own?.status === "hidden"
                ? "Tu reseña está oculta por moderación y no puedes restaurarla."
                : "Solo las cuentas de jugador o crítico activas pueden publicar reseñas."}
            </p>
          )}
          {ownerReady && canWrite && (
            <form onSubmit={form} className="review-form">
              <h3>{own ? "Tu reseña" : "Publicar tu reseña"}</h3>
              {own && (
                <p>
                  Estado:{" "}
                  {own.status === "withdrawn" ? "retirada" : "publicada"} ·
                  Versión guardada: {own.version}
                </p>
              )}
              {identity.role === "critic" && (
                <>
                  {questionsState.status === "loading" && (
                    <p role="status">Cargando preguntas críticas…</p>
                  )}
                  {questionsState.status === "error" && (
                    <p role="alert">
                      No pudimos cargar las preguntas. Tu borrador se conserva.{" "}
                      {questionsState.message}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy || questionsState.status === "loading"}
                    onClick={() => {
                      setQuestionsState({ status: "loading" });
                      setQuestionsAttempt((n) => n + 1);
                    }}
                  >
                    Reintentar preguntas críticas
                  </button>
                  {own?.kind !== "critic" &&
                    questionsState.status === "success" &&
                    !criticalOptions.platforms.length && (
                      <p>
                        El catálogo no dispone de plataformas para este juego.
                        No se puede publicar un análisis hasta que el catálogo
                        incluya una plataforma válida.
                      </p>
                    )}
                  {!draft.input.critical && own?.kind !== "critic" && (
                    <>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          questionsState.status !== "success" ||
                          !criticalOptions.platforms.length
                        }
                        onClick={() =>
                          store({
                            ...draft,
                            input: {
                              ...draft.input,
                              critical: emptyCritical(criticalOptions),
                            },
                            questions: criticalOptions.questions,
                          })
                        }
                      >
                        {own
                          ? "Convertir explícitamente a análisis crítico"
                          : "Preparar análisis crítico completo"}
                      </button>
                    </>
                  )}
                </>
              )}
              {draft.input.critical && (
                <>
                  {identity.role !== "critic" && (
                    <p>
                      {own?.kind === "critic"
                        ? "El análisis histórico se conserva. Los criterios y el contexto crítico son de solo lectura."
                        : "Tu rol actual no permite publicar este análisis. Puedes cancelar la preparación y conservar la reseña ordinaria."}
                    </p>
                  )}
                  {own?.kind !== "critic" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const input = { ...draft.input };
                          delete input.critical;
                          store({ ...draft, input, questions: undefined });
                        }}
                      >
                        Cancelar preparación crítica
                      </button>
                      {identity.role === "critic" && staleQuestions && (
                        <p role="alert">
                          El banco de preguntas cambió. Actualiza las preguntas
                          antes de publicar; revisa las respuestas nuevas.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={
                          busy ||
                          identity.role !== "critic" ||
                          questionsState.status !== "success"
                        }
                        onClick={() => {
                          const critical = reconcileCriticalQuestions(
                            draft.input.critical!,
                            draft.questions ?? [],
                            criticalOptions.questions,
                          );
                          if (!critical) {
                            setMessage(
                              "Hay respuestas a preguntas retiradas. Copia su contenido y vacía explícitamente esas respuestas antes de actualizar preguntas. Tu borrador se conserva.",
                            );
                            return;
                          }
                          store({
                            ...draft,
                            input: { ...draft.input, critical },
                            questions: criticalOptions.questions,
                          });
                          setMessage(
                            "Preguntas actualizadas. Se conservan las respuestas por pregunta; completa las nuevas respuestas necesarias.",
                          );
                        }}
                      >
                        Actualizar preguntas conservando respuestas
                      </button>
                    </>
                  )}
                  <CriticalEditor
                    value={draft.input.critical}
                    options={{
                      questions:
                        draft.questions ??
                        own?.critical?.answers.map((a) => a.question) ??
                        criticalOptions.questions,
                      platforms: criticalOptions.platforms,
                    }}
                    historicalPlatform={
                      own?.kind === "critic"
                        ? own.critical?.platform
                        : undefined
                    }
                    disabled={busy || identity.role !== "critic"}
                    onChange={(critical) => change({ critical })}
                  />
                </>
              )}
              <label>
                Nota (0–10)
                <input
                  disabled={
                    busy || !!draft.input.critical || own?.kind === "critic"
                  }
                  type="number"
                  min="0"
                  max="10"
                  step="any"
                  required
                  value={
                    Number.isFinite(
                      draft.input.critical && identity.role === "critic"
                        ? criticalMean(draft.input.critical.criteria)
                        : draft.input.rating,
                    )
                      ? draft.input.critical && identity.role === "critic"
                        ? criticalMean(draft.input.critical.criteria)
                        : draft.input.rating
                      : ""
                  }
                  onChange={(e) =>
                    change({
                      rating:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Título de la reseña
                <input
                  disabled={busy}
                  required
                  minLength={3}
                  ref={(control) => {
                    syncTextValidity(control, 120);
                  }}
                  value={draft.input.title}
                  onChange={(e) => textChange("title", e.currentTarget, 120)}
                />
              </label>
              <label>
                Opinión sin spoilers
                <textarea
                  disabled={busy}
                  required
                  minLength={20}
                  ref={(control) => {
                    syncTextValidity(control, 10000);
                  }}
                  value={draft.input.bodyPublic}
                  onChange={(e) =>
                    textChange("bodyPublic", e.currentTarget, 10000)
                  }
                />
              </label>
              <label>
                Spoilers opcionales
                <textarea
                  disabled={busy}
                  ref={(control) => {
                    syncTextValidity(control, 20000);
                  }}
                  value={draft.input.bodySpoiler}
                  onChange={(e) =>
                    textChange("bodySpoiler", e.currentTarget, 20000)
                  }
                />
              </label>
              <label>
                Pros (uno por línea, hasta 5)
                <textarea
                  disabled={busy}
                  value={draft.input.pros?.join("\n") ?? ""}
                  onChange={(e) =>
                    change({
                      pros: e.target.value ? e.target.value.split("\n") : [],
                    })
                  }
                />
              </label>
              <label>
                Contras (uno por línea, hasta 5)
                <textarea
                  disabled={busy}
                  value={draft.input.cons?.join("\n") ?? ""}
                  onChange={(e) =>
                    change({
                      cons: e.target.value ? e.target.value.split("\n") : [],
                    })
                  }
                />
              </label>
              <p>
                Cambiar la nota requiere cambiar también la opinión sin
                spoilers. Tu borrador se conserva en esta sesión del navegador.
              </p>
              {submissionBlock && <p role="alert">{submissionBlock}</p>}
              <button
                disabled={busy || uncertain || !!submissionBlock}
                type="submit"
              >
                {draft.version === null
                  ? "Publicar reseña"
                  : "Guardar cambios de reseña"}
              </button>
              {own && (
                <button
                  disabled={
                    busy ||
                    uncertain ||
                    (preparingCritical && identity.role !== "critic")
                  }
                  type="button"
                  onClick={() =>
                    void submit(
                      own.status === "withdrawn" ? "republish" : "withdraw",
                    )
                  }
                >
                  {own.status === "withdrawn"
                    ? "Republicar reseña"
                    : "Retirar reseña"}
                </button>
              )}
            </form>
          )}
          {ownerReady && (
            <>
              <button disabled={busy} onClick={() => void reload(false)}>
                Comprobar reseña guardada
              </button>
              <button disabled={busy} onClick={() => void reload(true)}>
                Cargar versión guardada y descartar borrador
              </button>
            </>
          )}
        </>
      )}
      {actor && ownerReady && !identity && (
        <button
          disabled={busy}
          onClick={() => {
            setOwnerReady(false);
            setOwnerAttempt((n) => n + 1);
          }}
        >
          Reintentar permisos y reseña
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
