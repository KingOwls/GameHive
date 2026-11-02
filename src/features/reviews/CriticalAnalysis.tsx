import { criticalMean } from "../../domain/rules";
import {
  criterionLabels,
  type CriticalDetails,
  type CriticalInput,
  type CriticalOptions,
  type CriterionKey,
} from "../../domain/models";
export function emptyCritical(options: CriticalOptions): CriticalInput {
  return {
    criteria: Object.fromEntries(
      Object.keys(criterionLabels).map((k) => [
        k,
        { score: 5, explanation: "" },
      ]),
    ) as CriticalInput["criteria"],
    platform: options.platforms[0] ?? "",
    hoursPlayed: 0,
    completed: false,
    copyProvided: false,
    scoreReason: "",
    answers: options.questions.map((q) => ({ questionId: q.id, answer: "" })),
  };
}
export function CriticalAnalysis({ details }: { details: CriticalDetails }) {
  return (
    <section aria-label="Análisis crítico completo">
      <p>
        Nota editorial: media simple de ocho criterios; las preguntas de género
        no alteran la nota.
      </p>
      <dl>
        {(Object.keys(criterionLabels) as CriterionKey[]).map((k) => (
          <div key={k}>
            <dt>
              {criterionLabels[k]}: {details.criteria[k].score} / 10
            </dt>
            <dd>{details.criteria[k].explanation}</dd>
          </div>
        ))}
      </dl>
      <p>
        Plataforma: {details.platform} · Horas jugadas: {details.hours_played} ·{" "}
        {details.completed ? "Finalizado" : "No finalizado"} ·{" "}
        {details.copy_provided ? "Copia facilitada" : "Copia no facilitada"}
      </p>
      <p>Justificación editorial: {details.score_reason}</p>
      {details.answers.map((a) => (
        <div key={a.question_id}>
          <h4>{a.question.prompt}</h4>
          <p>{a.answer}</p>
          <small>
            {a.question.provenance} · Versión {a.question.version}
          </small>
        </div>
      ))}
    </section>
  );
}
export function CriticalEditor({
  value,
  options,
  onChange,
  disabled,
  historicalPlatform,
}: {
  value: CriticalInput;
  options: CriticalOptions;
  onChange: (value: CriticalInput) => void;
  disabled: boolean;
  historicalPlatform?: string;
}) {
  const patch = (p: Partial<CriticalInput>) => onChange({ ...value, ...p });
  const mean = criticalMean(value.criteria);
  const platformValid =
    options.platforms.includes(value.platform) ||
    value.platform === historicalPlatform;
  return (
    <fieldset disabled={disabled}>
      <legend>Análisis crítico completo</legend>
      <p>
        Media orientativa: {Number.isFinite(mean) ? mean.toFixed(2) : "—"} / 10.
        El servidor calcula la nota definitiva.
      </p>
      <p>
        Los criterios, el contexto, la justificación y las respuestas son
        públicos y deben estar libres de spoilers. Coloca las revelaciones en la
        sección «Spoilers opcionales», que permanece oculta hasta que el lector
        la abra.
      </p>
      {(Object.keys(criterionLabels) as CriterionKey[]).map((k) => (
        <fieldset key={k}>
          <legend>{criterionLabels[k]}</legend>
          <label>
            Nota de {criterionLabels[k]}
            <input
              required
              type="number"
              min="0"
              max="10"
              step="0.01"
              value={
                Number.isFinite(value.criteria[k].score)
                  ? value.criteria[k].score
                  : ""
              }
              onChange={(e) =>
                patch({
                  criteria: {
                    ...value.criteria,
                    [k]: {
                      ...value.criteria[k],
                      score:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    },
                  },
                })
              }
            />
          </label>
          <label>
            Explicación de {criterionLabels[k]}
            <textarea
              required
              ref={(control) => criticalTextValidity(control, 10, 1000)}
              value={value.criteria[k].explanation}
              onChange={(e) =>
                patch({
                  criteria: {
                    ...value.criteria,
                    [k]: { ...value.criteria[k], explanation: e.target.value },
                  },
                })
              }
            />
          </label>
        </fieldset>
      ))}
      <label>
        Plataforma analizada
        <select
          required
          aria-invalid={!platformValid || undefined}
          ref={(control) =>
            control?.setCustomValidity(
              platformValid ? "" : "Elige una plataforma actual del catálogo.",
            )
          }
          value={value.platform}
          onChange={(e) => patch({ platform: e.target.value })}
        >
          {Array.from(
            new Set([
              ...options.platforms,
              ...(historicalPlatform ? [historicalPlatform] : []),
              value.platform,
            ]),
          )
            .filter(Boolean)
            .map((p) => (
              <option
                key={p}
                disabled={
                  !options.platforms.includes(p) && p !== historicalPlatform
                }
              >
                {p}
              </option>
            ))}
        </select>
      </label>
      <label>
        Horas jugadas
        <input
          required
          type="number"
          min="0"
          max="10000"
          step="any"
          value={Number.isFinite(value.hoursPlayed) ? value.hoursPlayed : ""}
          onChange={(e) =>
            patch({
              hoursPlayed: e.target.value === "" ? NaN : Number(e.target.value),
            })
          }
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.completed}
          onChange={(e) => patch({ completed: e.target.checked })}
        />
        He finalizado el juego
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.copyProvided}
          onChange={(e) => patch({ copyProvided: e.target.checked })}
        />
        He recibido una copia facilitada
      </label>
      <label>
        Justificación de la nota editorial
        <textarea
          required
          ref={(control) => criticalTextValidity(control, 20, 2000)}
          value={value.scoreReason}
          onChange={(e) => patch({ scoreReason: e.target.value })}
        />
      </label>
      <p>
        Preguntas de contenido editorial propio. Amplían el análisis sin alterar
        la media.
      </p>
      {value.answers.map((a, index) => {
        const q = options.questions.find((q) => q.id === a.questionId);
        return (
          <label key={a.questionId}>
            {q?.prompt ?? `Pregunta guardada ${index + 1}`}{" "}
            {q && `(versión ${q.version})`}
            <textarea
              required
              ref={(control) => criticalTextValidity(control, 1, 1000)}
              value={a.answer}
              onChange={(e) =>
                patch({
                  answers: value.answers.map((b) =>
                    b.questionId === a.questionId
                      ? { ...b, answer: e.target.value }
                      : b,
                  ),
                })
              }
            />
          </label>
        );
      })}
    </fieldset>
  );
}

function criticalTextValidity(
  control: HTMLTextAreaElement | null,
  min: number,
  max: number,
) {
  if (!control) return;
  const length = [...control.value.replace(/\s+/gu, " ").trim()].length;
  control.setCustomValidity(
    length < min || [...control.value].length > max
      ? `Usa entre ${min} y ${max} caracteres.`
      : "",
  );
}
