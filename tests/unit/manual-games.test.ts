import { afterEach, expect, it, vi } from "vitest";
import { validateManualGame } from "../../supabase/functions/_shared/manual-game-validation";
import {
  createManualGamesService,
  manualId,
} from "../../src/services/manual-games";
vi.mock("../../src/services/auth", () => ({
  getAuthService: () => ({
    session: async () => ({ access_token: "isolated-session-fixture" }),
  }),
}));
const valid = {
  title: "Celeste",
  synopsis: "Madeline afronta una montaña y desafíos de plataformas.",
  platforms: ["PC"],
  genres: ["Plataformas"],
  releasedAt: null,
  sourceUrl: "https://WWW.CELESTEGAME.COM:443/#game",
  sourceLabel: "Sitio oficial Celeste",
  reason: "Falta incorporar el juego al catálogo manual.",
};
afterEach(() => vi.unstubAllGlobals());
it("canonicalizes source without fetching it", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(validateManualGame(valid).sourceUrl).toBe(
    "https://www.celestegame.com/",
  );
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  "http://example.com",
  "javascript:alert(1)",
  "https://user:pass@example.com",
  "https://localhost/game",
  "https://127.0.0.1",
  "https://[::1]",
  "https://2130706433",
  "https://foo.local/game",
  "https://example.com/" + "x".repeat(2048),
])("rejects unsafe source %s", (sourceUrl) => {
  expect(() => validateManualGame({ ...valid, sourceUrl })).toThrow();
});
it.each([
  { title: "<script>bad</script>" },
  { synopsis: "<img src=x onerror=alert(1)>" },
  { genres: ["<b>RPG</b>"] },
  { platforms: ["Mobile"] },
  { platforms: [] },
  { reason: "short" },
  { releasedAt: "2026-02-30" },
  { releasedAt: "2100-01-01" },
])("rejects invalid metadata %j", (patch) => {
  expect(() => validateManualGame({ ...valid, ...patch })).toThrow();
});
it("keeps significant source path and query", () =>
  expect(
    validateManualGame({
      ...valid,
      sourceUrl: "https://example.com/game?edition=2#more",
    }).sourceUrl,
  ).toBe("https://example.com/game?edition=2"));
it("recovers from incomplete public configuration", async () => {
  const service = createManualGamesService({
    VITE_SUPABASE_URL: "https://example.com",
  });
  await expect(service.search("", 1)).rejects.toThrow(/incompleta/);
});
it("bounds search and isolates manual identifiers", async () => {
  const service = createManualGamesService({});
  await expect(service.search("x".repeat(101), 1)).rejects.toThrow();
  await expect(service.get("rawg:1")).resolves.toBeNull();
  expect(manualId("manual:00000000-0000-0000-0000-000000000001")).toBe(true);
});
it("paginates public reads and forwards cancellation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("[]", { headers: { "content-range": "0-0/24" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const service = createManualGamesService({
    VITE_SUPABASE_URL: "https://example.com",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  });
  const controller = new AbortController();
  const result = await service.search("Celeste", 2, controller.signal);
  expect(result.total).toBe(24);
  expect(fetch.mock.calls[0][0]).toContain("offset=12");
  expect(fetch.mock.calls[0][0]).toContain("title=ilike.");
  controller.abort();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});

it.each(["503", "lost-response"])(
  "keeps source recovery guidance for uncertain create acknowledgement: %s",
  async (kind) => {
    const fetch =
      kind === "503"
        ? vi.fn().mockResolvedValue(new Response("{}", { status: 503 }))
        : vi.fn().mockRejectedValue(new Error("isolated network fault"));
    vi.stubGlobal("fetch", fetch);
    const service = createManualGamesService({
      VITE_SUPABASE_URL: "https://example.com",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    await expect(service.create(valid)).rejects.toThrow(
      /comprueba la fuente antes de reintentar/,
    );
  },
);
