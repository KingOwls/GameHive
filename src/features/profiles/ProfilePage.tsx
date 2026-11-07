import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Page, LibraryProfile, PublicReview } from "../../domain/models";
import { createLibraryService } from "../../services/library";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
import { Pager } from "../library/LibraryPage";
const api = createLibraryService();
export function ProfilePage() {
  const { handle = "" } = useParams();
  return <Profile key={handle} handle={handle} />;
}
function Profile({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<LibraryProfile | null>(null),
    [reviews, setReviews] = useState<Page<PublicReview> | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .profile(handle, c.signal)
      .then(async (p) => {
        if (c.signal.aborted) return;
        setProfile(p);
        if (!p) {
          setError("Perfil no disponible.");
          return;
        }
        const r = await api.reviews(p.id, page, c.signal);
        if (!c.signal.aborted) {
          setReviews(r);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(publicError(e));
      });
    return () => c.abort();
  }, [handle, page, retry]);
  return (
    <section>
      {error && (
        <StatePanel kind="error" title={error}>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </StatePanel>
      )}
      {profile ? (
        <>
          <h1>{profile.username}</h1>
          <img
            src={`/avatars/${profile.avatar_key}.svg`}
            alt="Avatar GameHive"
            width="80"
            height="80"
          />
          <p>{profile.bio || "Sin biografía pública."}</p>
          <Link to={`/u/${profile.username}/library`}>
            Consultar biblioteca
          </Link>
          <h2>Reseñas públicas</h2>
          {reviews ? (
            <>
              {!reviews.items.length && <p>Sin reseñas públicas.</p>}
              {reviews.items.map((r) => (
                <article key={r.id}>
                  <h3>
                    <Link
                      to={
                        r.game_id
                          ? `/games/${r.game_id}`
                          : `/manual-games/manual:${r.manual_game_id}`
                      }
                    >
                      {r.title}
                    </Link>
                  </h3>
                  <p>{r.rating} / 10</p>
                  <p>{r.body_public}</p>
                </article>
              ))}
              <Pager
                label="Páginas de reseñas públicas"
                page={page}
                total={reviews.total}
                size={10}
                onChange={(n) => {
                  setPage(n);
                  setReviews(null);
                }}
              />
            </>
          ) : (
            <StatePanel kind="loading" title="Cargando reseñas" />
          )}
        </>
      ) : (
        !error && <StatePanel kind="loading" title="Cargando perfil" />
      )}
    </section>
  );
}
