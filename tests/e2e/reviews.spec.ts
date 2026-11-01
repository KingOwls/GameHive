import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reviewFixtures, reviewPayload } from "../helpers/reviews-local";
test.use({ trace: "off", screenshot: "off", video: "off" });
test(`${process.env.GH_REVIEWS_ISOLATED === "1" ? "isolated catalog contract" : "real persisted RAWG/manual"} reviews → second session → edit/conflict/refresh → withdraw/republish`, async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_REVIEWS !== "1",
    "Requires local real Supabase: npm run test:reviews -- --e2e",
  );
  test.setTimeout(120000);
  const f = await reviewFixtures(["user", "admin"]);
  const owner = f.accounts[0];
  const secondContext = await browser.newContext();
  const guestContext = await browser.newContext();
  if (f.isolatedDocument) {
    for (const context of [page.context(), secondContext, guestContext]) {
      await context.route(
        `**/functions/v1/catalog/games/${f.rawgId.slice(5)}`,
        (route) => route.fulfill({ json: f.isolatedDocument }),
      );
    }
  }
  const second = await secondContext.newPage(),
    guest = await guestContext.newPage();
  const login = async (p: Page) => {
    await p.goto("/login");
    await p.getByLabel("Correo electrónico").fill(owner.email);
    await p.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await p
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "Tu lugar en la colmena." }),
    ).toBeVisible();
  };
  try {
    await login(page);
    await login(second);
    for (const game of [f.manualId, f.rawgId]) {
      const route = game.startsWith("manual:")
        ? `/manual-games/${game}`
        : `/games/${game}`;
      const title = `${reviewPayload.title} ${f.marker}`;
      await page.goto(route);
      if (game === f.manualId) {
        for (const [label, max] of [
          ["Título de la reseña", 120],
          ["Opinión sin spoilers", 10000],
          ["Spoilers opcionales", 20000],
        ] as const) {
          const control = page.getByLabel(label);
          const maximum = "😀".repeat(max);
          await control.fill(maximum);
          expect(
            (await control.inputValue()) === maximum,
            `${label} preserves full emoji boundary`,
          ).toBe(true);
          expect(
            await control.evaluate(
              (node: HTMLInputElement | HTMLTextAreaElement) =>
                node.checkValidity(),
            ),
          ).toBe(true);
          await control.press("End");
          await page.keyboard.insertText("😀");
          expect([...(await control.inputValue())].length).toBe(max + 1);
          expect(
            await control.evaluate(
              (node: HTMLInputElement | HTMLTextAreaElement) =>
                node.checkValidity(),
            ),
          ).toBe(false);
          await control.fill("😀".repeat(max));
          expect(
            await control.evaluate(
              (node: HTMLInputElement | HTMLTextAreaElement) =>
                node.checkValidity(),
            ),
          ).toBe(true);
        }
      }
      await page.getByLabel("Título de la reseña").fill(title);
      await page.getByLabel("Nota (0–10)").fill("7");
      await page
        .getByLabel("Opinión sin spoilers")
        .fill(reviewPayload.bodyPublic);
      await page
        .getByLabel("Spoilers opcionales")
        .fill(reviewPayload.bodySpoiler);
      await page
        .getByLabel("Pros (uno por línea, hasta 5)")
        .fill("Controles precisos");
      await page
        .getByLabel("Contras (uno por línea, hasta 5)")
        .fill("Desafío exigente");
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("button", { name: "Publicar reseña", exact: true })
        .click();
      await expect(
        page.getByText("Reseña guardada.", { exact: true }),
      ).toBeVisible();
      await guest.goto(route);
      const publicRegion = guest.getByRole("region", {
        name: "Reseñas de la comunidad",
      });
      await expect(
        publicRegion.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        publicRegion.getByText(new RegExp(owner.username)),
      ).toBeVisible();
      await expect(
        publicRegion.getByText(/Cálculo de puntuación GameHive pendiente/),
      ).toBeVisible();
      await expect(
        publicRegion.getByText("Sin evaluaciones GameHive", { exact: true }),
      ).toHaveCount(0);
      await expect(
        publicRegion.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toHaveCount(0);
      const reveal = publicRegion
        .getByRole("button", { name: "Mostrar spoilers" })
        .last();
      await reveal.focus();
      await guest.keyboard.press("Enter");
      await expect(
        publicRegion.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page: guest })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await guest.reload();
      await expect(
        guest
          .getByRole("region", { name: "Reseñas de la comunidad" })
          .getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toHaveCount(0);
      await second.goto(route);
      await expect(second.getByLabel("Opinión sin spoilers")).toHaveValue(
        reviewPayload.bodyPublic,
      );
      const changed =
        "Una segunda lectura descubre una experiencia más completa y precisa.";
      await page.getByLabel("Nota (0–10)").fill("8");
      await page.getByLabel("Opinión sin spoilers").fill(changed);
      await page
        .getByRole("button", { name: "Guardar cambios de reseña" })
        .click();
      await expect(
        page.getByText("Estado: publicada · Versión guardada: 2"),
      ).toBeVisible();
      const draft =
        "Borrador de otra sesión conservado después del conflicto y la recarga.";
      await second.getByLabel("Opinión sin spoilers").fill(draft);
      await second
        .getByRole("button", { name: "Guardar cambios de reseña" })
        .click();
      await expect(
        second
          .getByRole("status")
          .filter({ hasText: "Tu reseña ya existe o cambió." }),
      ).toBeVisible();
      await expect(second.getByLabel("Opinión sin spoilers")).toHaveValue(
        draft,
      );
      await second.reload();
      await expect(second.getByLabel("Opinión sin spoilers")).toHaveValue(
        draft,
      );
      await second
        .getByRole("button", {
          name: "Cargar versión guardada y descartar borrador",
        })
        .click();
      await expect(second.getByLabel("Opinión sin spoilers")).toHaveValue(
        changed,
      );
      await expect(second.getByLabel("Nota (0–10)")).toHaveValue("8");
      await guest.reload();
      await expect(guest.getByText(changed, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Retirar reseña" }).click();
      await expect(
        page.getByText("Estado: retirada · Versión guardada: 3"),
      ).toBeVisible();
      await guest.reload();
      await expect(
        guest.getByRole("heading", { name: title, exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Republicar reseña" }).click();
      await expect(
        page.getByText("Estado: publicada · Versión guardada: 4"),
      ).toBeVisible();
      await guest.reload();
      await expect(
        guest.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Opinión sin spoilers")).toHaveValue(
        changed,
      );
    }
  } finally {
    await secondContext.close();
    await guestContext.close();
    f.cleanup();
  }
});
