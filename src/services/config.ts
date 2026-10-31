import { ServiceError } from "./errors";
export interface PublicConfig {
  url: string;
  publishableKey: string;
}
export function parsePublicConfig(
  env: Record<string, string | undefined>,
): PublicConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey)
    throw new ServiceError(
      "configuration",
      "La configuración pública de Supabase está incompleta.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError(
      "configuration",
      "La URL pública de Supabase no es válida.",
    );
  }
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  ) {
    throw new ServiceError(
      "configuration",
      "Supabase requiere una conexión segura.",
    );
  }
  if (!publishableKey.startsWith("sb_publishable_"))
    throw new ServiceError(
      "configuration",
      "Utiliza únicamente una clave publicable de Supabase.",
    );
  return { url, publishableKey };
}
