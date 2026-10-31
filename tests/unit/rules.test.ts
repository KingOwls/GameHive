import { describe, it, expect } from "vitest";
import { commentWaitMs, validateReview } from "../../src/domain/rules";
const created = "2026-10-31T00:00:00Z";
const review = {
  rating: 7,
  title: "Mi experiencia",
  bodyPublic: "Una aventura con combate preciso y exploración.",
  bodySpoiler: "",
};
describe("Reglas de dominio; no sustituyen autorización SQL", () => {
  it("espera 1 segundo a 9h59m59s y admite 10h exactas", () => {
    expect(commentWaitMs(created, "user", Date.parse(created) + 35999000)).toBe(
      1000,
    );
    expect(commentWaitMs(created, "user", Date.parse(created) + 36000000)).toBe(
      0,
    );
  });
  it("crítico inmediato, sin inferir verificación", () =>
    expect(commentWaitMs(created, "critic", Date.parse(created))).toBe(0));
  it("rechaza fechas inválidas", () =>
    expect(commentWaitMs("bad", "user", Date.now())).toBe(Infinity));
  it("exige cambiar texto con nota", () =>
    expect(validateReview({ ...review, rating: 8 }, review)).toContain(
      "Actualiza también tu opinión al cambiar la puntuación.",
    ));
  it("acepta texto y nota coordinados", () =>
    expect(
      validateReview(
        {
          ...review,
          rating: 8,
          bodyPublic: "Una segunda lectura revela detalles muy interesantes.",
        },
        review,
      ),
    ).toEqual([]));
  it.each([NaN, Infinity, -1, 11])("rechaza nota %s", (rating) =>
    expect(validateReview({ ...review, rating })).not.toEqual([]),
  );
});
