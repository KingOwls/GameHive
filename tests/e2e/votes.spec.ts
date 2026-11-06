import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reviewFixtures, reviewPayload } from "../helpers/reviews-local";
test.use({ trace: "off", screenshot: "off", video: "off" });
test(`${process.env.GH_REVIEWS_ISOLATED === "1" ? "isolated catalog contract" : "real persisted RAWG/manual"} irreversible vote persists in second session and recovers lost ACK`, async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_VOTES !== "1",
    "Requires npm run test:votes -- --e2e",
  );
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const f = await reviewFixtures(["user", "user", "admin"]);
  const contexts: BrowserContext[] = [];
  let voting: Page | undefined;
  try {
    const [author, voter] = f.accounts;
    const voterContext = await browser.newContext();
    contexts.push(voterContext);
    const secondContext = await browser.newContext();
    contexts.push(secondContext);
    const guestContext = await browser.newContext();
    contexts.push(guestContext);
    for (const context of [voterContext, secondContext, guestContext]) {
      context.setDefaultTimeout(15000);
      context.setDefaultNavigationTimeout(20000);
    }
    voting = await voterContext.newPage();
    const second = await secondContext.newPage(),
      guest = await guestContext.newPage();
    if (f.isolatedDocument)
      for (const ctx of [
        page.context(),
        voterContext,
        secondContext,
        guestContext,
      ])
        await ctx.route(
          `**/functions/v1/catalog/games/${f.rawgId.slice(5)}`,
          (route) => route.fulfill({ json: f.isolatedDocument }),
        );
    const login = async (p: Page, a: typeof author) => {
      await p.goto("/login");
      await p.getByLabel("Correo electrónico").fill(a.email);
      await p.getByLabel("Contraseña", { exact: true }).fill(a.password);
      await p
        .getByRole("button", { name: "Iniciar sesión", exact: true })
        .click();
      await expect(
        p.getByRole("heading", { name: "Tu lugar en la colmena." }),
      ).toBeVisible();
    };
    await login(page, author);
    await login(voting, voter);
    await login(second, voter);
    for (const game of [f.manualId, f.rawgId]) {
      console.log(
        "Vote acceptance catalog:",
        game.startsWith("manual:") ? "manual" : "rawg",
      );
      const path = game.startsWith("manual:")
        ? `/manual-games/${game}`
        : `/games/${game}`;
      const title = `${reviewPayload.title} ${f.marker}`;
      await page.goto(path);
      await page.getByLabel("Título de la reseña").fill(title);
      await page
        .getByLabel("Opinión sin spoilers")
        .fill(reviewPayload.bodyPublic);
      await page
        .getByLabel("Spoilers opcionales")
        .fill(reviewPayload.bodySpoiler);
      await page
        .getByRole("button", { name: "Publicar reseña", exact: true })
        .click();
      await expect(
        page.getByText("Reseña guardada.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("No puedes votar tu propia reseña."),
      ).toBeVisible();
      await guest.goto(path);
      const guestCard = guest.getByRole("article").filter({
        has: guest.getByRole("heading", { name: title, exact: true }),
      });
      await expect(
        guestCard.getByText("Útiles: 0 · No útiles: 0"),
      ).toBeVisible();
      await expect(
        guestCard.getByRole("link", { name: "Inicia sesión para votar" }),
      ).toBeVisible();
      await voting.goto(path);
      const card = voting.getByRole("article").filter({
        has: voting.getByRole("heading", { name: title, exact: true }),
      });
      await expect(card.getByText(/Tu voto es irreversible:/)).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Votar útil", exact: true }),
      ).toBeEnabled();
      await voting
        .getByLabel("Título de la reseña")
        .fill("Borrador que sobrevive al voto");
      const spoilerButton = card.getByRole("button", { name: /spoiler/i });
      await spoilerButton.click();
      await expect(
        card.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toBeVisible();
      const useful = game === f.manualId;
      if (useful) {
        // Backend commits, browser loses its ACK. The recovery GET must discover the vote.
        await voting.route(
          "**/functions/v1/review-votes",
          async (route) => {
            if (route.request().method() !== "POST") {
              await route.continue();
              return;
            }
            const response = await route.fetch();
            expect(response.status()).toBe(201);
            await route.abort("failed");
          },
          { times: 1 },
        );
      }
      const button = card.getByRole("button", {
        name: useful ? "Votar útil" : "Votar no útil",
        exact: true,
      });
      await button.focus();
      await voting.keyboard.press("Enter");
      const saved = `Tu voto irreversible: ${useful ? "útil" : "no útil"}. No puedes cambiarlo ni retirarlo.`;
      await expect(card.getByText(saved, { exact: true })).toBeVisible();
      await expect(
        card.getByText(
          useful ? "Útiles: 1 · No útiles: 0" : "Útiles: 0 · No útiles: 1",
        ),
      ).toBeVisible();
      await expect(voting.getByLabel("Título de la reseña")).toHaveValue(
        "Borrador que sobrevive al voto",
      );
      await expect(
        card.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Votar útil", exact: true }),
      ).toHaveCount(0);
      await expect(
        card.getByRole("button", { name: "Votar no útil", exact: true }),
      ).toHaveCount(0);
      await second.goto(path);
      const persisted = second.getByRole("article").filter({
        has: second.getByRole("heading", { name: title, exact: true }),
      });
      await expect(persisted.getByText(saved, { exact: true })).toBeVisible();
      await second.reload();
      await expect(persisted.getByText(saved, { exact: true })).toBeVisible();
      await guest.reload();
      await expect(
        guestCard.getByText(
          useful ? "Útiles: 1 · No útiles: 0" : "Útiles: 0 · No útiles: 1",
        ),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page: voting })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  } finally {
    try {
      f.cleanup();
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
    }
  }
});
