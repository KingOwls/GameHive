import {
  criterionLabels,
  type CriticalInput,
  type CriticalQuestion,
  type ReviewInput,
} from "../../domain/models";

export interface ReviewDraft {
  input: ReviewInput;
  version: number | null;
  baseline: ReviewInput | undefined;
  questions?: CriticalQuestion[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
// JSON encodes unfinished number inputs (NaN) as null. Restore their empty state.
const number = (value: unknown) =>
  typeof value === "number" ? value : value === null ? NaN : undefined;
function input(value: unknown): ReviewInput | null {
  if (!object(value)) return null;
  const rating = number(value.rating);
  if (
    rating === undefined ||
    ![value.title, value.bodyPublic, value.bodySpoiler].every(
      (v) => typeof v === "string",
    ) ||
    ![value.pros ?? [], value.cons ?? []].every(
      (v) => Array.isArray(v) && v.every((p) => typeof p === "string"),
    )
  )
    return null;
  let critical: CriticalInput | undefined;
  if (value.critical !== undefined) {
    const c = value.critical;
    if (
      !object(c) ||
      !object(c.criteria) ||
      !Object.keys(criterionLabels).every((k) =>
        object(c.criteria && (c.criteria as Record<string, unknown>)[k]),
      ) ||
      typeof c.platform !== "string" ||
      number(c.hoursPlayed) === undefined ||
      typeof c.completed !== "boolean" ||
      typeof c.copyProvided !== "boolean" ||
      typeof c.scoreReason !== "string" ||
      !Array.isArray(c.answers) ||
      c.answers.some(
        (a) =>
          !object(a) ||
          typeof a.questionId !== "string" ||
          typeof a.answer !== "string",
      )
    )
      return null;
    const criteria: CriticalInput["criteria"] = {} as CriticalInput["criteria"];
    for (const k of Object.keys(
      criterionLabels,
    ) as (keyof typeof criterionLabels)[]) {
      const entry = c.criteria[k];
      if (
        !object(entry) ||
        number(entry.score) === undefined ||
        typeof entry.explanation !== "string"
      )
        return null;
      criteria[k] = {
        score: number(entry.score)!,
        explanation: entry.explanation,
      };
    }
    critical = {
      ...c,
      criteria,
      hoursPlayed: number(c.hoursPlayed)!,
    } as unknown as CriticalInput;
  }
  return {
    ...value,
    rating,
    ...(critical ? { critical } : {}),
  } as unknown as ReviewInput;
}
function questions(value: unknown): value is CriticalQuestion[] {
  return (
    Array.isArray(value) &&
    value.every(
      (q) =>
        object(q) &&
        [q.id, q.question_key, q.prompt, q.genre, q.provenance].every(
          (v) => typeof v === "string",
        ) &&
        Number.isInteger(q.version) &&
        Number(q.version) > 0,
    )
  );
}
export function readReviewDraft(key: string): ReviewDraft | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!object(value)) return null;
    const next = input(value.input);
    const baseline =
      value.baseline === undefined ? undefined : input(value.baseline);
    if (
      !next ||
      baseline === null ||
      !(
        value.version === null ||
        (Number.isInteger(value.version) && Number(value.version) > 0)
      ) ||
      (value.questions !== undefined && !questions(value.questions))
    )
      return null;
    return {
      input: next,
      baseline,
      version: value.version as number | null,
      ...(value.questions
        ? { questions: value.questions as CriticalQuestion[] }
        : {}),
    };
  } catch {
    return null;
  }
}
export function reconcileCriticalQuestions(
  critical: CriticalInput,
  previous: CriticalQuestion[],
  current: CriticalQuestion[],
): CriticalInput | null {
  const losesAnswer = critical.answers.some(
    (a) =>
      a.answer !== "" &&
      !current.some(
        (q) =>
          q.id === a.questionId ||
          q.question_key ===
            previous.find((old) => old.id === a.questionId)?.question_key,
      ),
  );
  if (losesAnswer) return null;
  const byKey = new Map(
    previous.map((q) => [
      q.question_key,
      critical.answers.find((a) => a.questionId === q.id)?.answer ?? "",
    ]),
  );
  return {
    ...critical,
    answers: current.map((q) => ({
      questionId: q.id,
      answer:
        byKey.get(q.question_key) ??
        critical.answers.find((a) => a.questionId === q.id)?.answer ??
        "",
    })),
  };
}
