import { it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CriticalEditor } from "../../src/features/reviews/CriticalAnalysis";
import { criticalFixture } from "../helpers/critical";
it("restored Unicode critical drafts use code-point bounds and exact decimal mean", () => {
  const options = {
    platforms: ["PC"],
    questions: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        question_key: "test",
        version: 1,
        genre: "*",
        prompt: "Pregunta editorial de prueba",
        provenance: "Contenido editorial propio de GameHive",
      },
    ],
  };
  const value = criticalFixture(options);
  for (const key of Object.keys(
    value.criteria,
  ) as (keyof typeof value.criteria)[])
    value.criteria[key] = {
      score: key === "value" ? 2.04 : 2,
      explanation: "😀".repeat(1000),
    };
  value.scoreReason = "🎮".repeat(2000);
  value.answers[0].answer = "🌟".repeat(1000);
  const view = render(
    <CriticalEditor
      value={value}
      options={options}
      disabled={false}
      onChange={() => {}}
    />,
  );
  expect(screen.getByText(/Media orientativa: 2.01/)).toBeVisible();
  for (const label of [
    "Explicación de Arte",
    "Justificación de la nota editorial",
    "Pregunta editorial de prueba (versión 1)",
  ])
    expect(
      (screen.getByLabelText(label) as HTMLTextAreaElement).checkValidity(),
    ).toBe(true);
  view.rerender(
    <CriticalEditor
      value={{ ...value, scoreReason: value.scoreReason + "🎮" }}
      options={options}
      disabled={false}
      onChange={() => {}}
    />,
  );
  expect(
    (
      screen.getByLabelText(
        "Justificación de la nota editorial",
      ) as HTMLTextAreaElement
    ).checkValidity(),
  ).toBe(false);
  cleanup();
});
