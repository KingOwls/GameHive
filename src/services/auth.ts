import {
  isAuthSessionMissingError,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Identity, PublicProfile, UserSettings } from "../domain/models";
import { ServiceError } from "./errors";
import { createSupabaseClient } from "./supabase";

export interface AuthService {
  session(): Promise<Session | null>;
  subscribe(callback: (session: Session | null) => void): () => void;
  register(email: string, password: string, username: string): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  identity(): Promise<Identity>;
  profile(id: string): Promise<PublicProfile>;
  updateProfile(
    id: string,
    profile: Pick<PublicProfile, "username" | "bio" | "avatar_key">,
  ): Promise<PublicProfile>;
  settings(id: string): Promise<UserSettings>;
  updateSettings(
    id: string,
    settings: Omit<UserSettings, "user_id">,
  ): Promise<UserSettings>;
}
const failure = () =>
  new ServiceError(
    "unavailable",
    "No pudimos completar la operación. Inténtalo de nuevo.",
  );
const invalidLogin = () =>
  new ServiceError(
    "unauthorized",
    "No pudimos iniciar sesión. Revisa tus credenciales e inténtalo de nuevo.",
  );
export function createAuthService(client: SupabaseClient): AuthService {
  return {
    async session() {
      const { data, error } = await client.auth.getSession();
      if (error) throw failure();
      return data.session;
    },
    subscribe(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        callback(session),
      );
      return () => data.subscription.unsubscribe();
    },
    async register(email, password, username) {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 12)
        throw new ServiceError(
          "validation",
          "Usa un alias de 3–24 letras, números o guion bajo y una contraseña de al menos 12 caracteres.",
        );
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error)
        throw new ServiceError(
          "validation",
          "No pudimos crear la cuenta. Revisa los datos o prueba otro alias.",
        );
      if (!data.session)
        throw new ServiceError(
          "configuration",
          "La cuenta requiere confirmación por correo. Comprueba tu bandeja antes de iniciar sesión.",
        );
      return data.session;
    },
    async login(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) throw invalidLogin();
      return data.session;
    },
    async logout() {
      const current = await client.auth.getSession();
      if (current.error) throw failure();
      if (!current.data.session) return;
      // The SDK clears local credentials even when logout fails over the network.
      // Revoke first through the same Auth endpoint, retaining the real session on
      // failure so the user can retry. Only clear local state after server ACK.
      const revoked = await client.auth.admin.signOut(
        current.data.session.access_token,
        "local",
      );
      if (
        revoked.error &&
        ![401, 403, 404].includes(revoked.error.status ?? 0) &&
        !isAuthSessionMissingError(revoked.error)
      )
        throw failure();
      await client.auth.signOut({ scope: "local" });
      const { data, error: checkError } = await client.auth.getSession();
      if (checkError || data.session) throw failure();
    },
    async identity() {
      const { data, error } = await client.functions.invoke<Identity>(
        "identity",
        { body: {} },
      );
      if (error || !data) throw failure();
      return data;
    },
    async profile(id) {
      const { data, error } = await client
        .from("profiles")
        .select("id,username,bio,avatar_key,reputation_score,created_at")
        .eq("id", id)
        .single();
      if (error || !data) throw failure();
      return data as PublicProfile;
    },
    async updateProfile(id, profile) {
      const { data, error } = await client
        .from("profiles")
        .update(profile)
        .eq("id", id)
        .select("id,username,bio,avatar_key,reputation_score,created_at")
        .single();
      if (error || !data)
        throw new ServiceError(
          "validation",
          "No se guardó el perfil. Revisa el alias y vuelve a intentarlo.",
        );
      return data as PublicProfile;
    },
    async settings(id) {
      const { data, error } = await client
        .from("private_user_settings")
        .select("*")
        .eq("user_id", id)
        .single();
      if (error || !data) throw failure();
      return data as UserSettings;
    },
    async updateSettings(id, settings) {
      const { data, error } = await client
        .from("private_user_settings")
        .update(settings)
        .eq("user_id", id)
        .select("*")
        .single();
      if (error || !data) throw failure();
      return data as UserSettings;
    },
  };
}
let singleton: AuthService | null | undefined;
export function getAuthService(): AuthService | null {
  if (singleton !== undefined) return singleton;
  const client = createSupabaseClient();
  singleton = client ? createAuthService(client) : null;
  return singleton;
}
