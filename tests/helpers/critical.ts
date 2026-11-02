import type { CriticalInput, CriticalOptions } from "../../src/domain/models";
import { criterionLabels } from "../../src/domain/models";
export const criticalFixture = (options: CriticalOptions): CriticalInput => ({
  criteria: Object.fromEntries(
    Object.keys(criterionLabels).map((key, index) => [
      key,
      {
        score: index + 2,
        explanation: `Valoración propia y detallada del criterio ${key}.`,
      },
    ]),
  ) as CriticalInput["criteria"],
  platform: options.platforms[0],
  hoursPlayed: 25.5,
  completed: true,
  copyProvided: false,
  scoreReason:
    "Los ocho criterios reflejan una experiencia equilibrada y esta es su justificación editorial.",
  answers: options.questions.map((q) => ({
    questionId: q.id,
    answer: "Respuesta propia que contextualiza la experiencia de juego.",
  })),
});
