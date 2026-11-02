import { afterEach, it, expect, vi } from "vitest";
import { validateReview } from "../../src/domain/rules";
import { validateReviewRequest } from "../../supabase/functions/_shared/review-validation";
import { createReviewsService } from "../../src/services/reviews";
const input = {
  rating: 0,
  title: "Prueba",
  bodyPublic: "Una opinión pública suficientemente extensa.",
  bodySpoiler: "<script>Literal</script>",
  pros: ["Precisión"],
  cons: [],
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([NaN, Infinity, -1, 11])(
  "rejects non-finite/outside rating %s in server validation",
  (rating) => {
    expect(() =>
      validateReviewRequest({
        action: "create",
        gameId: "rawg:42",
        input: { ...input, rating },
      }),
    ).toThrow();
  },
);
it("normalizes internal whitespace and ignores title/spoiler only changes when rating changes", () => {
  expect(
    validateReview(
      {
        ...input,
        rating: 10,
        title: "Otro título",
        bodyPublic: input.bodyPublic.replaceAll(" ", "\u00a0\n"),
        bodySpoiler: "Otro spoiler",
      },
      input,
    ),
  ).toContain("Actualiza también tu opinión al cambiar la puntuación.");
});
it.each([
  { title: "aa" },
  { bodyPublic: "short" },
  { bodySpoiler: "a".repeat(20001) },
  { pros: Array(6).fill("a") },
  { cons: ["a".repeat(201)] },
  { pros: [null] },
])("checks text/list bounds at Edge %j", (patch) => {
  expect(() =>
    validateReviewRequest({
      action: "create",
      gameId: "rawg:42",
      input: { ...input, ...patch },
    }),
  ).toThrow();
});
it("accepts rating endpoints and escaped markup as plain text", () => {
  expect(validateReview(input)).toEqual([]);
  expect(validateReview({ ...input, rating: 10 })).toEqual([]);
  expect(
    validateReviewRequest({ action: "create", gameId: "rawg:42", input }).input,
  ).toEqual(input);
});
it.each(["slug-offline", "manual:nope", "rawg:NaN"])(
  "rejects invalid game %s before fetching",
  async (id) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(createReviewsService().list(id, 1)).rejects.toThrow(
      /juego real/,
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("public service paginates and selects only public author fields", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("[]", { headers: { "content-range": "10-19/25" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const service = createReviewsService({
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  });
  const result = await service.list(
    "manual:00000000-0000-0000-0000-000000000001",
    2,
  );
  expect(result).toMatchObject({ total: 25, page: 2, pageSize: 10 });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get("offset")).toBe("10");
  expect(url.searchParams.get("manual_game_id")).toBe(
    "eq.00000000-0000-0000-0000-000000000001",
  );
  expect(url.searchParams.get("select")).toBe(
    "*,profiles!author_id(username,avatar_key),review_critic_details(*,review_critic_answers(*,critic_questions(*)))",
  );
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
});
it("service ignores raw database error bodies", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("secret postgres password token", { status: 503 }),
      ),
  );
  const service = createReviewsService({
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  });
  await expect(service.list("rawg:42", 1)).rejects.toThrow(
    "Comprueba tu reseña guardada",
  );
});

vi.mock("../../src/services/auth", () => ({
  getAuthService: () => ({
    session: async () => ({ access_token: "fixture" }),
  }),
}));
it.each(["invalid JSON", "interrupted body"])(
  "sanitizes a successful mutation with %s as uncertain503",
  async (kind) => {
    const response =
      kind === "invalid JSON"
        ? new Response("{private invalid payload", { status: 201 })
        : new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("private stream failure"));
              },
            }),
            { status: 201 },
          );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const service = createReviewsService({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    });
    await expect(
      service.mutate("create", "rawg:42", null, input),
    ).rejects.toMatchObject({
      name: "ServiceError",
      status: 503,
      message:
        "No pudimos confirmar el cambio. Comprueba tu reseña guardada antes de reintentar.",
    });
  },
);
it("reaches page101 with a safe exact offset", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("[]", { headers: { "content-range": "*/1010" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const service = createReviewsService({
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  });
  expect(await service.list("rawg:42", 101)).toMatchObject({
    page: 101,
    total: 1010,
  });
  expect(new URL(fetch.mock.calls[0][0]).searchParams.get("offset")).toBe(
    "1000",
  );
  for (const page of [
    0,
    1.1,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    await expect(service.list("rawg:42", page)).rejects.toThrow(
      "Página inválida.",
    );
  expect(fetch).toHaveBeenCalledTimes(1);
});
