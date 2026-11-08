import type {
  AdminCriticApplication,
  ApplicationNotice,
  ApplicationPage,
  CriticApplication,
  CriticApplicationInput,
} from "../domain/models";
import { getAuthService } from "./auth";
import { parsePublicConfig } from "./config";
import { ServiceError } from "./errors";
export class ApplicationsError extends ServiceError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super("unavailable", message);
  }
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" &&
  Array.from(v.trim()).length >= min &&
  Array.from(v.trim()).length <= max;
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
export function validApplicationInput(
  value: unknown,
): value is CriticApplicationInput {
  const v = value as CriticApplicationInput;
  return (
    !!v &&
    text(v.organization, 3, 120) &&
    text(v.experience, 40, 3000) &&
    text(v.sample, 40, 5000) &&
    Array.isArray(v.links) &&
    v.links.length <= 3 &&
    v.links.every((link) => {
      if (
        !text(link, 1, 2048) ||
        !/^https:\/\//i.test(link) ||
        /\s/.test(link)
      )
        return false;
      try {
        const url = new URL(link);
        return (
          url.protocol === "https:" &&
          !!url.hostname &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    })
  );
}
const unavailable = () =>
  new ApplicationsError(503, "No pudimos comprobar el estado guardado.");
export function parseApplication(value: unknown): CriticApplication {
  const a = value as CriticApplication;
  if (
    !validApplicationInput(a) ||
    !uuid(a.id) ||
    !uuid(a.user_id) ||
    !["user", "critic"].includes(a.expected_role) ||
    a.expected_status !== "active" ||
    typeof a.expected_verified !== "boolean" ||
    (a.expected_role === "critic" && a.expected_verified) ||
    !date(a.created_at) ||
    !["pending", "approved", "rejected", "cancelled"].includes(a.status) ||
    (a.status === "pending"
      ? a.version !== 1 ||
        a.resolved_at !== null ||
        a.resolved_by !== null ||
        a.reason !== null
      : a.version !== 2 ||
        !date(a.resolved_at) ||
        (a.resolved_by !== null && !uuid(a.resolved_by)) ||
        !text(a.reason, 10, 500))
  )
    throw unavailable();
  return a;
}
export function parseAdminApplication(value: unknown): AdminCriticApplication {
  const a = parseApplication(value) as AdminCriticApplication;
  const current = a.current_authority;
  if (
    !current ||
    !["user", "critic", "moderator", "admin"].includes(current.role) ||
    !["active", "suspended"].includes(current.status) ||
    typeof current.critic_verified !== "boolean"
  )
    throw unavailable();
  return a;
}
export function parseApplicationNotice(value: unknown): ApplicationNotice {
  const n = value as ApplicationNotice;
  if (
    !n ||
    !uuid(n.id) ||
    !uuid(n.user_id) ||
    !uuid(n.application_id) ||
    !["approved", "rejected", "cancelled"].includes(n.outcome) ||
    !text(n.reason, 10, 500) ||
    !date(n.created_at) ||
    (n.read_at !== null && !date(n.read_at))
  )
    throw unavailable();
  return n;
}
export function createCriticApplicationsService(
  env: Record<string, string | undefined> = import.meta.env,
) {
  async function operation(
    name: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const config = parsePublicConfig(env);
    const session = await getAuthService()?.session();
    if (!config || !session)
      throw new ApplicationsError(
        config ? 401 : 503,
        config
          ? "Inicia sesión de nuevo."
          : "Configura Supabase para consultar candidaturas.",
      );
    try {
      const response = await fetch(
        `${config.url}/functions/v1/critic-applications`,
        {
          method: "POST",
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ operation: name, input }),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
            : AbortSignal.timeout(12000),
        },
      );
      if (!response.ok)
        throw new ApplicationsError(
          response.status,
          (
            {
              400: "Revisa los datos de la candidatura.",
              401: "Inicia sesión de nuevo.",
              403: "Cuenta o sesión sin permiso para esta operación.",
              409: "La solicitud cambió o aún debes esperar. Consulta el estado guardado; el borrador se conserva.",
            } as Record<number, string>
          )[response.status] ??
            "No pudimos confirmar el resultado. Consulta el estado guardado antes de reintentar.",
        );
      return await response.json();
    } catch (e) {
      if (e instanceof ApplicationsError) throw e;
      throw unavailable();
    }
  }
  async function page<T>(
    name: string,
    page: number,
    parse: (v: unknown) => T,
    signal?: AbortSignal,
  ): Promise<ApplicationPage<T>> {
    if (!Number.isInteger(page) || page < 1 || page > 99999)
      throw new ApplicationsError(400, "Página inválida.");
    const p = (await operation(
      name,
      { page },
      signal,
    )) as ApplicationPage<unknown>;
    if (
      !p ||
      !Array.isArray(p.items) ||
      p.items.length > 20 ||
      p.page !== page ||
      p.pageSize !== 20 ||
      !Number.isSafeInteger(p.total) ||
      p.total < 0 ||
      typeof p.eligible !== "boolean" ||
      typeof p.hasPending !== "boolean" ||
      (p.nextAllowedAt !== null && !date(p.nextAllowedAt))
    )
      throw unavailable();
    return { ...p, items: p.items.map(parse) };
  }
  return {
    history: (p = 1, s?: AbortSignal) =>
      page("own-history", p, parseApplication, s),
    queue: (p = 1, s?: AbortSignal) =>
      page("admin-queue", p, parseAdminApplication, s),
    adminHistory: (p = 1, s?: AbortSignal) =>
      page("admin-history", p, parseAdminApplication, s),
    adminGet: async (id: string, s?: AbortSignal) =>
      parseAdminApplication(await operation("admin-get", { id }, s)),
    notices: (p = 1, s?: AbortSignal) =>
      page("own-notices", p, parseApplicationNotice, s),
    async submit(input: CriticApplicationInput, s?: AbortSignal) {
      if (!validApplicationInput(input))
        throw new ApplicationsError(
          400,
          "Revisa las longitudes y los enlaces HTTPS.",
        );
      return parseApplication(await operation("submit", { ...input }, s));
    },
    async resolve(
      a: CriticApplication,
      decision: "approved" | "rejected",
      reason: string,
      s?: AbortSignal,
    ) {
      return parseApplication(
        await operation(
          "resolve",
          { id: a.id, version: a.version, decision, reason },
          s,
        ),
      );
    },
    async cancel(a: CriticApplication, reason: string, s?: AbortSignal) {
      return parseApplication(
        await operation("cancel", { id: a.id, version: a.version, reason }, s),
      );
    },
    async markRead(id: string, s?: AbortSignal) {
      return parseApplicationNotice(await operation("markRead", { id }, s));
    },
  };
}
export type CriticApplicationsService = ReturnType<
  typeof createCriticApplicationsService
>;
