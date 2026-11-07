import { describe, it, expect, vi } from "vitest";
import {
  AuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createAuthService } from "../../src/services/auth";
describe("logout acknowledgements", () => {
  it.each([401, 403, 404, "missing"])(
    "clears credentials when server reports absent session (%s)",
    async (status) => {
      const signOut = vi.fn().mockResolvedValue({ error: null });
      const getSession = vi
        .fn()
        .mockResolvedValueOnce({
          data: { session: { access_token: "test-token" } },
          error: null,
        })
        .mockResolvedValueOnce({ data: { session: null }, error: null });
      const sdk = {
        auth: {
          getSession,
          signOut,
          admin: {
            signOut: vi.fn().mockResolvedValue({
              error:
                status === "missing"
                  ? new AuthSessionMissingError()
                  : { status },
            }),
          },
        },
      } as unknown as SupabaseClient;
      await expect(createAuthService(sdk).logout()).resolves.toBeUndefined();
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    },
  );
  it("retains session when revocation has no server acknowledgement", async () => {
    const signOut = vi.fn();
    const sdk = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "test-token" } },
          error: null,
        }),
        signOut,
        admin: { signOut: vi.fn().mockResolvedValue({ error: { status: 0 } }) },
      },
    } as unknown as SupabaseClient;
    await expect(createAuthService(sdk).logout()).rejects.toThrow(
      "No pudimos completar",
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("ordinary preferences never publish a library", () => {
  it("whitelists ordinary fields even when a stale caller supplies visibility", async () => {
    const update = vi
      .fn()
      .mockReturnValue({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { user_id: "actor" }, error: null }),
          }),
        }),
      });
    const sdk = { from: () => ({ update }) } as unknown as SupabaseClient;
    const stale = {
      theme_mode: "dark" as const,
      library_visibility: "public",
      library_visibility_version: 1,
      platforms: ["PC"],
      genres: [],
      interests: "test",
      onboarding_complete: true,
    };
    await createAuthService(sdk).updateSettings("actor", stale);
    expect(update.mock.calls[0][0]).not.toHaveProperty("library_visibility");
    expect(update.mock.calls[0][0]).not.toHaveProperty(
      "library_visibility_version",
    );
  });
});
