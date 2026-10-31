import { createClient } from "@supabase/supabase-js";
import { parsePublicConfig } from "./config";
export function createSupabaseClient() {
  const config = parsePublicConfig(import.meta.env);
  return config ? createClient(config.url, config.publishableKey) : null;
}
