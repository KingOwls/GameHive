import type { ReviewVote } from "../domain/models";
import { parsePublicConfig } from "./config";
import { getAuthService } from "./auth";
import { ServiceError } from "./errors";
export interface ReviewVotesService {
  own(reviewIds: string[], signal?: AbortSignal): Promise<ReviewVote[]>;
  vote(
    reviewId: string,
    value: 1 | -1,
    signal?: AbortSignal,
  ): Promise<ReviewVote>;
}
export class VoteError extends ServiceError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super("unavailable", message);
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createReviewVotesService(
  env: Record<string, string | undefined> = import.meta.env,
): ReviewVotesService {
  const request = async (path: string, init: RequestInit) => {
    const config = parsePublicConfig(env);
    if (!config)
      throw new ServiceError(
        "configuration",
        "Configura Supabase para consultar votos.",
      );
    const session = await getAuthService()?.session();
    if (!session)
      throw new VoteError(401, "Inicia sesión de nuevo para votar.");
    try {
      const response = await fetch(
        `${config.url}/functions/v1/review-votes${path}`,
        {
          ...init,
          signal: init.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)])
            : AbortSignal.timeout(12000),
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: "Revisa la reseña y el valor del voto.",
          401: "Inicia sesión de nuevo para votar.",
          403: "No puedes votar esta reseña o tu sesión ya no está vigente.",
          409: "Ya tienes un voto irreversible. Comprueba tu voto guardado.",
          429: "Has alcanzado el límite de votos. Espera antes de volver a intentarlo.",
        };
        throw new VoteError(
          response.status,
          messages[response.status] ??
            "No pudimos confirmar el voto. Comprueba tu voto guardado antes de reintentar.",
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof VoteError) throw error;
      throw new VoteError(
        503,
        "No pudimos confirmar el voto. Comprueba tu voto guardado antes de reintentar.",
      );
    }
  };
  const validate = (ids: string[]) => {
    if (
      !ids.length ||
      ids.length > 10 ||
      ids.some((id) => !uuid.test(id)) ||
      new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
    )
      throw new ServiceError(
        "validation",
        "Consulta entre una y diez reseñas distintas.",
      );
  };
  const parseVote = (data: unknown): ReviewVote => {
    if (!data || typeof data !== "object")
      throw new VoteError(
        503,
        "No pudimos confirmar el voto. Comprueba tu voto guardado.",
      );
    const row = data as ReviewVote;
    if (
      !uuid.test(row.reviewId) ||
      ![null, 1, -1].includes(row.value) ||
      [row.helpfulCount, row.unhelpfulCount].some(
        (n) => n !== null && (!Number.isSafeInteger(n) || n < 0),
      )
    )
      throw new VoteError(
        503,
        "No pudimos confirmar el voto. Comprueba tu voto guardado.",
      );
    return row;
  };
  return {
    async own(ids, signal) {
      validate(ids);
      const data = await request(
        `?${new URLSearchParams({ reviewIds: ids.join(",") })}`,
        { signal },
      );
      if (!Array.isArray(data.votes) || data.votes.length !== ids.length)
        throw new VoteError(503, "No pudimos comprobar tu voto guardado.");
      const rows = data.votes.map(parseVote);
      if (
        rows.some(
          (row: ReviewVote, i: number) =>
            row.reviewId.toLowerCase() !== ids[i].toLowerCase(),
        )
      )
        throw new VoteError(503, "No pudimos comprobar tu voto guardado.");
      return rows;
    },
    async vote(id, value, signal) {
      validate([id]);
      if (value !== 1 && value !== -1)
        throw new ServiceError(
          "validation",
          "El voto debe ser útil o no útil.",
        );
      const row = parseVote(
        await request("", {
          method: "POST",
          signal,
          body: JSON.stringify({ reviewId: id, value }),
        }),
      );
      if (
        row.reviewId.toLowerCase() !== id.toLowerCase() ||
        row.value !== value
      )
        throw new VoteError(
          503,
          "No pudimos confirmar el voto. Comprueba tu voto guardado.",
        );
      return row;
    },
  };
}
