import { it, expect } from "vitest";
import {
  validateCritical,
  validateReviewRequest,
} from "../../supabase/functions/_shared/review-validation";
import { criticalFixture } from "../helpers/critical";
const critical = criticalFixture({ platforms: ["PC"], questions: [] });
it("accepts eight independent criteria and explicit conversion", () => {
  expect(() => validateCritical(critical)).not.toThrow();
  expect(() =>
    validateReviewRequest({
      gameId: "rawg:42",
      action: "convert",
      version: 1,
      input: {
        critical,
        rating: 1,
        title: "Crítica",
        bodyPublic:
          "Una opinión pública realmente distinta y suficientemente amplia.",
        bodySpoiler: "",
      },
    }),
  ).not.toThrow();
});
it.each([NaN, Infinity, -0.1, 10.01, 1.001, 1.00000000001])(
  "rejects invalid criterion score %s",
  (score) => {
    expect(() =>
      validateCritical({
        ...critical,
        criteria: {
          ...critical.criteria,
          gameplay: {
            score,
            explanation: "Explicación suficientemente amplia.",
          },
        },
      }),
    ).toThrow();
  },
);
it.each([
  {
    criteria: {
      ...critical.criteria,
      extra: { score: 1, explanation: "Una explicación válida." },
    },
  },
  { criteria: { ...critical.criteria, art: undefined } },
  { hoursPlayed: -1 },
  { hoursPlayed: 10001 },
  { hoursPlayed: Infinity },
  { completed: "true" },
  { copyProvided: undefined },
  { scoreReason: "breve" },
  { platform: "" },
  {
    answers: Array.from({ length: 13 }, () => ({
      questionId: "00000000-0000-0000-0000-000000000001",
      answer: "x",
    })),
  },
])("rejects incomplete critical context %j", (patch) =>
  expect(() => validateCritical({ ...critical, ...patch })).toThrow(),
);
it("allows two decimal boundaries and Unicode explanations", () => {
  expect(() =>
    validateCritical({
      ...critical,
      criteria: {
        ...critical.criteria,
        gameplay: { score: 9.99, explanation: "😀".repeat(1000) },
      },
    }),
  ).not.toThrow();
  expect(() =>
    validateCritical({
      ...critical,
      criteria: {
        ...critical.criteria,
        gameplay: { score: 9.99, explanation: "😀".repeat(1001) },
      },
    }),
  ).toThrow();
});

it("rounds exact decimal mean half upwards like PostgreSQL numeric", async () => {
  const { criticalMean } = await import("../../src/domain/rules");
  const c = { ...critical.criteria };
  for (const key of Object.keys(c) as (keyof typeof c)[])
    c[key] = { score: 2, explanation: "Valid explanation" };
  c.value = { score: 2.04, explanation: "Valid explanation" };
  expect(criticalMean(c)).toBe(2.01);
});
it("accepts a full Unicode critical body above the former160KB ceiling within256KB and rejects overflow", async () => {
  const { manualDeadline, readManualBody } =
    await import("../../supabase/functions/_shared/manual-game-deadline");
  const deadline = manualDeadline(new AbortController().signal);
  const text = JSON.stringify({
    bodyPublic: "😀".repeat(10000),
    bodySpoiler: "🎮".repeat(20000),
    criteria: Array.from({ length: 8 }, () => ({
      score: 10,
      explanation: "🌟".repeat(1000),
    })),
    scoreReason: "🚀".repeat(2000),
    answers: Array.from({ length: 12 }, () => ({ answer: "🎯".repeat(1000) })),
  });
  try {
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(160000);
    expect(new TextEncoder().encode(text).length).toBeLessThan(262144);
    expect(
      (
        await readManualBody(
          new Request("https://fixture.invalid", {
            method: "POST",
            body: text,
          }),
          deadline,
          262144,
        )
      ).bodyPublic,
    ).toBe("😀".repeat(10000));
    await expect(
      readManualBody(
        new Request("https://fixture.invalid", {
          method: "POST",
          body: "x".repeat(262145),
        }),
        deadline,
        262144,
      ),
    ).rejects.toThrow("Body too large");
    await expect(
      readManualBody(
        new Request("https://fixture.invalid", { method: "POST", body: text }),
        deadline,
      ),
    ).rejects.toThrow("Body too large");
  } finally {
    deadline.dispose();
  }
});
