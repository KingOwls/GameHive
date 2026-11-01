import type {
  Page,
  PublicReview,
  Review,
  ReviewAction,
  ReviewInput,
} from "../domain/models";
import { parsePublicConfig } from "./config";
import { getAuthService } from "./auth";
import { ServiceError } from "./errors";
export interface ReviewsService {
  list(
    gameId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<Page<PublicReview>>;
  own(gameId: string, signal?: AbortSignal): Promise<Review | null>;
  mutate(
    action: ReviewAction,
    gameId: string,
    version: number | null,
    input?: ReviewInput,
    signal?: AbortSignal,
  ): Promise<Review>;
}
export class ReviewError extends ServiceError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super("unavailable", message);
  }
}
export const persistedReviewGame = (id: string) =>
  /^rawg:[0-9]+$/.test(id) ||
  /^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
export function reviewInput(review: Review): ReviewInput {
  return {
    rating: Number(review.rating),
    title: review.title,
    bodyPublic: review.body_public,
    bodySpoiler: review.body_spoiler,
    pros: review.pros,
    cons: review.cons,
  };
}
export function createReviewsService(
  env: Record<string, string | undefined> = import.meta.env,
): ReviewsService {
  const request = async (
    path: string,
    authenticated: boolean,
    init: RequestInit = {},
  ) => {
    const config = parsePublicConfig(env);
    if (!config)
      throw new ServiceError(
        "configuration",
        "Configura Supabase para consultar y publicar reseñas.",
      );
    const session = authenticated ? await getAuthService()?.session() : null;
    if (authenticated && !session)
      throw new ReviewError(401, "Inicia sesión de nuevo.");
    let response: Response;
    try {
      response = await fetch(`${config.url}${path}`, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)])
          : AbortSignal.timeout(12000),
        headers: {
          apikey: config.publishableKey,
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new ReviewError(
        503,
        "No pudimos confirmar la operación. Comprueba tu reseña guardada antes de reintentar.",
      );
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "Revisa el juego, la versión y los campos de tu reseña.",
        401: "Inicia sesión de nuevo.",
        403: "No tienes permiso o tu sesión ya no está vigente.",
        404: "No existe una reseña propia para este juego.",
        409: "Tu reseña ya existe o cambió. Conserva el borrador y carga la versión guardada.",
      };
      throw new ReviewError(
        response.status,
        messages[response.status] ??
          "No pudimos confirmar el cambio. Comprueba tu reseña guardada antes de reintentar.",
      );
    }
    return response;
  };
  const game = (id: string) => {
    if (!persistedReviewGame(id))
      throw new ServiceError(
        "validation",
        "Las reseñas necesitan un juego real persistido.",
      );
  };
  return {
    async list(gameId, page, signal) {
      game(gameId);
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger((page - 1) * 10)
      )
        throw new ServiceError("validation", "Página inválida.");
      const params = new URLSearchParams({
        select: "*,profiles!author_id(username,avatar_key)",
        order: "created_at.desc,id.asc",
        limit: "10",
        offset: String((page - 1) * 10),
      });
      params.set(
        gameId.startsWith("manual:") ? "manual_game_id" : "game_id",
        `eq.${gameId.startsWith("manual:") ? gameId.slice(7) : gameId}`,
      );
      const response = await request(`/rest/v1/reviews?${params}`, false, {
        signal,
        headers: { Prefer: "count=exact" },
      });
      const items = (await response.json()) as PublicReview[];
      return {
        items,
        total: Number(
          response.headers.get("content-range")?.split("/")[1] ?? items.length,
        ),
        page,
        pageSize: 10,
      };
    },
    async own(gameId, signal) {
      game(gameId);
      const response = await request(
        `/functions/v1/reviews?${new URLSearchParams({ gameId })}`,
        true,
        { signal },
      );
      return (await response.json()) as Review | null;
    },
    async mutate(action, gameId, version, input, signal) {
      game(gameId);
      const response = await request("/functions/v1/reviews", true, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          gameId,
          version,
          ...(input ? { input } : {}),
        }),
      });
      try {
        return (await response.json()) as Review;
      } catch {
        throw new ReviewError(
          503,
          "No pudimos confirmar el cambio. Comprueba tu reseña guardada antes de reintentar.",
        );
      }
    },
  };
}
