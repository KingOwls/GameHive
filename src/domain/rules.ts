import type { Role, ReviewInput } from "./models";
export function commentWaitMs(
  createdAt: string,
  role: Role,
  now: number,
): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(now)) return Infinity;
  return Math.max(
    0,
    created + (role === "critic" ? 0 : 10 * 60 * 60 * 1000) - now,
  );
}
export function validateReview(
  next: ReviewInput,
  previous?: ReviewInput,
): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(next.rating) || next.rating < 0 || next.rating > 10)
    errors.push("La puntuación debe estar entre 0 y 10.");
  if (next.title.trim().length < 3 || next.title.length > 120)
    errors.push("El título debe tener entre 3 y 120 caracteres.");
  if (next.bodyPublic.trim().length < 20 || next.bodyPublic.length > 10000)
    errors.push("La opinión debe tener entre 20 y 10000 caracteres.");
  if (next.bodySpoiler.length > 20000)
    errors.push("La sección con spoilers es demasiado larga.");
  if (
    previous &&
    next.rating !== previous.rating &&
    next.bodyPublic.trim() === previous.bodyPublic.trim()
  )
    errors.push("Actualiza también tu opinión al cambiar la puntuación.");
  return errors;
}
