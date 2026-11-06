import { afterEach, it, expect, vi } from "vitest";
import {
  createReviewVotesService,
  VoteError,
} from "../../src/services/review-votes";
vi.mock("../../src/services/auth", () => ({
  getAuthService: () => ({
    session: async () => ({ access_token: "test-session" }),
  }),
}));
const env = {
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const id = "60000000-0000-0000-0000-000000000001";
afterEach(() => vi.unstubAllGlobals());
it("requests only own votes in a batch of ten and sends no voter identity", async () => {
  const row = { reviewId: id, value: 1, helpfulCount: 1, unhelpfulCount: 0 };
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ votes: [row] }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await createReviewVotesService(env).own([id])).toEqual([row]);
  const [url, request] = fetch.mock.calls[0];
  expect(url).toContain("reviewIds=");
  expect(url).not.toContain("voter");
  expect(request.headers.Authorization).toBe("Bearer test-session");
});
it("rejects invalid duplicate/oversized batch before network", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const service = createReviewVotesService(env);
  for (const ids of [[], [id, id], Array(11).fill(id), ["invalid"]])
    await expect(service.own(ids)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it.each([400, 401, 403, 409, 429, 503])(
  "maps HTTP %s without trusting server error text",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"error":"private token"}', { status }),
        ),
    );
    await expect(
      createReviewVotesService(env).vote(id, 1),
    ).rejects.toMatchObject({ status });
    try {
      await createReviewVotesService(env).vote(id, 1);
    } catch (error) {
      expect((error as Error).message).not.toContain("private token");
    }
  },
);
it("turns lost or invalid ACK into uncertain 503", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("network")));
  await expect(
    createReviewVotesService(env).vote(id, -1),
  ).rejects.toBeInstanceOf(VoteError);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response('{"reviewId":"wrong"}')),
  );
  await expect(
    createReviewVotesService(env).vote(id, -1),
  ).rejects.toMatchObject({ status: 503 });
});
