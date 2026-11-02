import { beforeEach, expect, it } from "vitest";
import {
  readReviewDraft,
  reconcileCriticalQuestions,
} from "../../src/features/reviews/reviewDraft";
import { criticalFixture } from "../helpers/critical";
const q = {
  id: "q-one",
  question_key: "experience",
  version: 1,
  genre: "*",
  prompt: "Una pregunta editorial original",
  provenance: "Contenido editorial propio",
};
const ordinary = {
  rating: NaN,
  title: "Título conservado",
  bodyPublic: "Opinión aún sin terminar",
  bodySpoiler: "",
  pros: [],
  cons: [],
};
beforeEach(() => sessionStorage.clear());
it("restores empty critical numbers and incomplete editorial text with immutable questions", () => {
  const critical = criticalFixture({ platforms: ["PC"], questions: [q] });
  critical.criteria.art = { score: NaN, explanation: "" };
  critical.hoursPlayed = NaN;
  sessionStorage.setItem(
    "draft",
    JSON.stringify({
      input: { ...ordinary, critical },
      version: null,
      questions: [q],
    }),
  );
  const restored = readReviewDraft("draft")!;
  expect(restored.input.rating).toBeNaN();
  expect(restored.input.critical!.criteria.art.score).toBeNaN();
  expect(restored.input.critical!.hoursPlayed).toBeNaN();
  expect(restored.input.critical!.criteria.art.explanation).toBe("");
  expect(restored.questions).toEqual([q]);
});
it.each([{}, { criteria: {} }, null, { answers: {} }])(
  "rejects structurally corrupt critical drafts %j without throwing",
  (critical) => {
    sessionStorage.setItem(
      "draft",
      JSON.stringify({ input: { ...ordinary, critical }, version: null }),
    );
    expect(() => readReviewDraft("draft")).not.toThrow();
    expect(readReviewDraft("draft")).toBeNull();
  },
);
it("reconciles changed IDs by stable key and preserves every context/criterion field", () => {
  const critical = criticalFixture({ platforms: ["PC"], questions: [q] });
  critical.answers[0].answer = "Respuesta que debe conservarse";
  const current = [
    { ...q, id: "q-two", version: 2, prompt: "Pregunta nueva" },
    { ...q, id: "q-three", question_key: "audience" },
  ];
  const next = reconcileCriticalQuestions(critical, [q], current);
  expect(next).toEqual({
    ...critical,
    answers: [
      { questionId: "q-two", answer: "Respuesta que debe conservarse" },
      { questionId: "q-three", answer: "" },
    ],
  });
});
it("blocks reconciliation while a removed question has a nonempty answer", () => {
  const critical = criticalFixture({ platforms: ["PC"], questions: [q] });
  critical.answers[0].answer =
    "Respuesta retirada que debe copiarse antes de vaciar";
  const before = structuredClone(critical);
  expect(reconcileCriticalQuestions(critical, [q], [])).toBeNull();
  expect(critical).toEqual(before);
  critical.answers[0].answer = "";
  expect(reconcileCriticalQuestions(critical, [q], [])).toEqual({
    ...critical,
    answers: [],
  });
});
