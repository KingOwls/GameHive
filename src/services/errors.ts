export type ErrorCode =
  | "configuration"
  | "unauthorized"
  | "rate_limit"
  | "unavailable"
  | "validation";
export class ServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export function publicError(error: unknown): string {
  return error instanceof ServiceError
    ? error.message
    : "No pudimos completar la operación. Inténtalo de nuevo.";
}
