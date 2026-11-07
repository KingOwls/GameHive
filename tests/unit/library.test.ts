import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createLibraryService,
  libraryGameId,
  parseLibrarySnapshot,
  validLibraryMarks,
} from "../../src/services/library";
vi.mock("../../src/services/auth", () => ({
  getAuthService: () => ({ session: async () => null }),
}));
afterEach(() => vi.unstubAllGlobals());
describe("library contracts", () => {
  it("accepts only persisted game identities and independent marks", () => {
    expect(libraryGameId("rawg:12")).toBe(true);
    expect(libraryGameId("curated:test")).toBe(false);
    for (const state of [null, "wishlist", "playing", "completed", "backlog"])
      expect(
        validLibraryMarks({
          state,
          favorite: false,
          interested: true,
          progress: 0,
        }),
      ).toBe(true);
    for (const progress of [-1, 101, 1.5, "4"])
      expect(
        validLibraryMarks({
          state: null,
          favorite: false,
          interested: false,
          progress,
        }),
      ).toBe(false);
  });
  it("rejects malformed acknowledgements", () => {
    expect(
      parseLibrarySnapshot({
        entry: null,
        visibility: "private",
        visibilityVersion: 1,
      }).entry,
    ).toBeNull();
    for (const value of [
      null,
      {},
      { entry: null, visibility: "public", visibilityVersion: 0 },
      { entry: {}, visibility: "private", visibilityVersion: 1 },
    ])
      expect(() => parseLibrarySnapshot(value)).toThrow();
  });
  it("paginates and filters before ranges with exact counts and normalized equality", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("[]", { headers: { "content-range": "0-0/45" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const api = createLibraryService({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    const r = await api.list("60000000-0000-0000-0000-000000000001", 2, {
      favorite: true,
      state: "playing",
      interested: true,
    });
    expect(r.total).toBe(45);
    expect(r.pageSize).toBe(20);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("favorite")).toBe("eq.true");
    expect(url.searchParams.get("state")).toBe("eq.playing");
    expect(url.searchParams.get("select")).toBe(
      "*,games(document),manual_games(*)",
    );
    fetch.mockResolvedValueOnce(new Response("[]"));
    await api.profile("Mixed_Alias");
    expect(
      new URL(fetch.mock.calls[1][0]).searchParams.get("username_normalized"),
    ).toBe("eq.mixed_alias");
  });
  it("requests ten public reviews per page and twenty persisted games with exact totals", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("[]", { headers: { "content-range": "*/37" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const api = createLibraryService({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    const reviews = await api.reviews(
      "60000000-0000-0000-0000-000000000001",
      2,
    );
    expect(reviews).toMatchObject({ total: 37, page: 2, pageSize: 10 });
    const reviewUrl = new URL(fetch.mock.calls[0][0]);
    expect(reviewUrl.searchParams.get("select")).toBe(
      "*,profiles!author_id(username,avatar_key)",
    );
    expect(reviewUrl.searchParams.get("limit")).toBe("10");
    expect(reviewUrl.searchParams.get("offset")).toBe("10");
    expect(reviewUrl.searchParams.get("order")).toBe("created_at.desc,id.asc");
    expect(reviewUrl.searchParams.get("author_id")).toBe(
      "eq.60000000-0000-0000-0000-000000000001",
    );
    const games = await api.search("Celeste", 2);
    expect(games).toMatchObject({ total: 37, page: 2, pageSize: 20 });
    const searchUrl = new URL(fetch.mock.calls[1][0]);
    expect(searchUrl.searchParams.get("offset")).toBe("20");
    expect(searchUrl.searchParams.get("order")).toBe("title.asc,id.asc");
    expect(fetch.mock.calls[1][1].headers.Prefer).toBe("count=exact");
  });
  it("whitelists mark fields when the draft originated from an existing entry", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          entry: null,
          visibility: "private",
          visibilityVersion: 1,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLibraryService({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    const entry = {
      id: "60000000-0000-0000-0000-000000000001",
      user_id: "60000000-0000-0000-0000-000000000002",
      game_id: "rawg:12",
      manual_game_id: null,
      state: null,
      favorite: false,
      interested: false,
      progress: null,
      version: 1,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    await api.save("rawg:12", { ...entry, favorite: true }, entry);
    expect(
      Object.keys(JSON.parse(fetch.mock.calls[0][1].body).input).sort(),
    ).toEqual([
      "favorite",
      "gameId",
      "id",
      "interested",
      "progress",
      "state",
      "version",
    ]);
  });
  it("validates biography length in Unicode codepoints consistently with PostgreSQL", async () => {
    const profile = {
      id: "60000000-0000-0000-0000-000000000001",
      username: "Emoji_Alias",
      bio: "🎮".repeat(500),
      avatar_key: "hive",
      created_at: "2026-11-07T00:00:00Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([profile])))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ...profile, bio: "🎮".repeat(501) }])),
      );
    vi.stubGlobal("fetch", fetch);
    const api = createLibraryService({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    await expect(api.profile("Emoji_Alias")).resolves.toEqual(profile);
    await expect(api.profile("Emoji_Alias")).rejects.toThrow(
      "Perfil público no disponible.",
    );
  });
});
