import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { libraryPaginationFixtures } from "../helpers/library-pagination";
import { reviewFixtures, reviewDb } from "../helpers/reviews-local";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("library manual detail and persisted RAWG search, two sessions and explicit sharing @library", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_LIBRARY !== "1",
    "Requires test:library -- --e2e",
  );
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const f = await reviewFixtures(["user", "user", "admin"]);
  const contexts: BrowserContext[] = [];
  try {
    const [owner] = f.accounts;
    const secondContext = await browser.newContext(),
      guestContext = await browser.newContext();
    contexts.push(secondContext, guestContext);
    for (const ctx of contexts) {
      ctx.setDefaultTimeout(15000);
      ctx.setDefaultNavigationTimeout(20000);
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
    console.log("Library E2E: signing in two sessions");
    await login(page);
    await login(second);
    console.log("Library E2E: manual detail save");
    await page.goto(`/manual-games/${f.manualId}`);
    const action = page.getByRole("region", {
      name: "Guardar juego en biblioteca",
    });
    await expect(
      action.getByRole("button", { name: "Guardar en biblioteca" }),
    ).toBeEnabled();
    await action
      .getByRole("combobox", { name: /^Estado/ })
      .selectOption("playing");
    await action.getByLabel("Favorito", { exact: true }).check();
    await action.getByLabel("Progreso opcional (0–100)").fill("31");
    await action.getByRole("button", { name: "Guardar en biblioteca" }).click();
    await expect(
      action.getByText("Juego guardado en tu biblioteca."),
    ).toBeVisible();
    console.log("Library E2E: own library read");
    await second.goto("/library");
    await expect(second.getByText("1 juegos accesibles")).toBeVisible();
    const saved = second
      .getByRole("article")
      .filter({
        has: second.getByRole("heading", { name: "Celeste", exact: true }),
      })
      .filter({ hasText: "Progreso: 31" });
    await expect(saved.first()).toBeVisible();
    console.log("Library E2E: concurrent marks and uncertain acknowledgement");
    const ownedManual = second
      .getByRole("article")
      .filter({ has: second.locator(`a[href="/manual-games/${f.manualId}"]`) });
    await ownedManual
      .getByRole("button", { name: "Organizar este juego" })
      .click();
    await ownedManual
      .getByRole("combobox", { name: /^Estado/ })
      .selectOption("backlog");
    await ownedManual
      .getByRole("button", { name: "Guardar en biblioteca" })
      .click();
    await expect(
      ownedManual.getByText("Juego guardado en tu biblioteca."),
    ).toBeVisible();
    await action.getByLabel("Progreso opcional (0–100)").fill("34");
    await action.getByRole("button", { name: "Guardar en biblioteca" }).click();
    await expect(action.getByRole("alert")).toBeVisible();
    await expect(action.getByLabel("Progreso opcional (0–100)")).toHaveValue(
      "34",
    );
    await action
      .getByRole("button", { name: "Consultar estado guardado" })
      .click();
    await action
      .getByRole("button", {
        name: "Aplicar borrador sobre la versión consultada",
      })
      .click();
    await action.getByRole("button", { name: "Guardar en biblioteca" }).click();
    await expect(
      action.getByText("Juego guardado en tu biblioteca."),
    ).toBeVisible();
    let loseAck = true;
    let writes = 0;
    await page.route("**/functions/v1/library", async (route) => {
      if (route.request().postDataJSON()?.operation === "update" && loseAck) {
        loseAck = false;
        writes++;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await action.getByLabel("Progreso opcional (0–100)").fill("45");
    await action.getByRole("button", { name: "Guardar en biblioteca" }).click();
    await expect(action.getByRole("alert")).toBeVisible();
    await action
      .getByRole("button", { name: "Consultar estado guardado" })
      .click();
    await expect(
      action.getByText(/Versión consultada:.*Progreso: 45/),
    ).toBeVisible();
    expect(writes).toBe(1);
    await page.unroute("**/functions/v1/library");
    console.log("Library E2E: public privacy boundaries");
    await guest.goto(`/u/${owner.username.toUpperCase()}/library`);
    await expect(guest.getByText("0 juegos accesibles")).toBeVisible();
    let privacyWrites = 0;
    await second.route("**/functions/v1/library", async (route) => {
      if (route.request().postDataJSON()?.operation === "privacy") {
        privacyWrites++;
        const committed = await route.fetch();
        expect(committed.status()).toBe(200);
        expect(await committed.json()).toMatchObject({
          visibility: "public",
          visibilityVersion: 2,
        });
        await route.abort("failed");
      } else await route.continue();
    });
    await second
      .getByRole("button", { name: "Publicar mi biblioteca", exact: true })
      .click();
    await expect(
      second.getByText(
        "Privacidad actual: Sin confirmar: consulta el estado guardado",
      ),
    ).toBeVisible();
    await expect(
      second.getByRole("button", {
        name: "Publicar mi biblioteca",
        exact: true,
      }),
    ).toBeDisabled();
    const savedPrivacy = second.waitForResponse(
      (response) =>
        response.url().includes("/functions/v1/library") &&
        response.request().postDataJSON()?.operation === "settings",
    );
    await second
      .getByRole("button", { name: "Consultar privacidad y estado guardados" })
      .click();
    expect(await (await savedPrivacy).json()).toMatchObject({
      visibility: "public",
      visibilityVersion: 2,
    });
    await expect(second.getByText("Privacidad actual: Pública")).toBeVisible();
    expect(privacyWrites).toBe(1);
    await expect(
      second.getByRole("button", { name: "Hacer privada", exact: true }),
    ).toBeEnabled();
    await second.unroute("**/functions/v1/library");
    await guest.reload();
    await expect(guest.getByText("1 juegos accesibles")).toBeVisible();
    await second
      .getByRole("button", { name: "Hacer privada", exact: true })
      .click();
    await expect(second.getByText("Privacidad actual: Privada")).toBeVisible();
    await guest.reload();
    await expect(guest.getByText("0 juegos accesibles")).toBeVisible();
    // Persisted search adds RAWG without opening a provider-backed detail.
    await second.goto("/library");
    const title = JSON.parse(
      reviewDb(
        `select document::text from public.games where id='${f.rawgId}';`,
      ),
    ).title;
    await second.getByLabel("Buscar juegos disponibles").fill(title);
    await second.getByRole("button", { name: "Buscar", exact: true }).click();
    const target = second.getByRole("article").filter({
      has: second.getByRole("heading", { name: title, exact: true }),
    });
    await expect(target).toHaveCount(1);
    await target.getByRole("button", { name: "Organizar este juego" }).click();
    await target.getByRole("button", { name: "Guardar en biblioteca" }).click();
    await expect(
      target.getByText("Juego guardado en tu biblioteca."),
    ).toBeVisible();
    await second.reload();
    await expect(second.getByText("2 juegos accesibles")).toBeVisible();
    // Re-add the manual fixture through the persisted search as well.
    await second.getByLabel("Buscar juegos disponibles").fill("Celeste");
    await second.getByRole("button", { name: "Buscar", exact: true }).click();
    const manualSearch = second
      .locator("section")
      .filter({
        has: second.getByRole("heading", {
          name: "Añadir juegos disponibles en GameHive",
          exact: true,
        }),
      })
      .last()
      .getByRole("article")
      .filter({ has: second.locator(`a[href="/manual-games/${f.manualId}"]`) });
    await manualSearch
      .getByRole("button", { name: "Organizar este juego" })
      .click();
    await manualSearch
      .getByRole("button", { name: "Retirar de biblioteca" })
      .click();
    await expect(second.getByText("1 juegos accesibles")).toBeVisible();
    await manualSearch.getByLabel("Favorito", { exact: true }).check();
    await manualSearch
      .getByRole("button", { name: "Guardar en biblioteca" })
      .click();
    await expect(second.getByText("2 juegos accesibles")).toBeVisible();
    await second.getByLabel("Solo favoritos").check();
    await expect(second.getByText("1 juegos accesibles")).toBeVisible();
    await page.goto(`/u/${owner.username}`);
    await expect(
      page.getByRole("heading", { name: owner.username, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Consultar biblioteca" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/u/${owner.username}/library$`));
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  } finally {
    try {
      f.cleanup();
    } finally {
      await Promise.allSettled(contexts.map((c) => c.close()));
    }
  }
});

test("isolated persisted library boundaries and eleven public profile reviews @library", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_LIBRARY !== "1",
    "Requires test:library -- --e2e",
  );
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const f = await reviewFixtures(["user", "admin"]);
  const owner = f.accounts[0];
  let fixture: ReturnType<typeof libraryPaginationFixtures> | undefined;
  let guestContext: BrowserContext | undefined;
  try {
    fixture = libraryPaginationFixtures(owner.id, f.marker);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu lugar en la colmena." }),
    ).toBeVisible();
    await page.goto("/library");
    await expect(page.getByText("24 juegos accesibles")).toBeVisible();
    const titles = () =>
      page.getByRole("heading", {
        level: 2,
        name: /^Isolated library pagination/,
      });
    await expect(titles()).toHaveCount(20);
    expect(await titles().allTextContents()).toEqual(
      fixture.games.slice(0, 20).map((g) => g.title),
    );
    const nav = page.getByRole("navigation", { name: "Páginas de biblioteca" });
    await nav.getByRole("button", { name: "Siguiente" }).click();
    await expect(titles()).toHaveCount(4);
    const secondPage = await titles().allTextContents();
    expect(secondPage).toEqual(fixture.games.slice(20).map((g) => g.title));
    expect(
      new Set([
        ...fixture.games.slice(0, 20).map((g) => g.title),
        ...secondPage,
      ]).size,
    ).toBe(24);
    await page.getByLabel("Solo favoritos").check();
    await expect(page.getByText("21 juegos accesibles")).toBeVisible();
    await expect(titles()).toHaveCount(20);
    await nav.getByRole("button", { name: "Siguiente" }).click();
    await expect(titles()).toHaveCount(1);
    await expect(titles()).toHaveText(fixture.games[20].title);
    const last = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        level: 2,
        name: fixture.games[20].title,
        exact: true,
      }),
    });
    await last.getByRole("button", { name: "Organizar este juego" }).click();
    await expect(
      last.getByRole("button", { name: "Retirar de biblioteca" }),
    ).toBeEnabled();
    await last.getByRole("button", { name: "Retirar de biblioteca" }).click();
    await expect(page.getByText("20 juegos accesibles")).toBeVisible();
    await expect(nav.getByText("Página 1")).toBeVisible();
    await expect(titles()).toHaveCount(20);
    await expect(nav.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await page
      .getByRole("combobox", { name: /^Filtrar estado/ })
      .selectOption("playing");
    await expect(page.getByText("20 juegos accesibles")).toBeVisible();
    await page.getByLabel("Solo me interesa").check();
    await expect(page.getByText("10 juegos accesibles")).toBeVisible();
    await expect(titles()).toHaveCount(10);
    expect(await titles().allTextContents()).toEqual(
      fixture.games
        .slice(0, 20)
        .filter((g) => g.index % 2 === 0)
        .map((g) => g.title),
    );
    guestContext = await browser.newContext();
    guestContext.setDefaultTimeout(15000);
    guestContext.setDefaultNavigationTimeout(20000);
    const consumer = await guestContext.newPage();
    const firstReviewsResponse = consumer.waitForResponse((response) =>
      response.url().includes("/rest/v1/reviews?"),
    );
    await consumer.goto(`/u/${owner.username.toUpperCase()}`);
    const publicResponse = await firstReviewsResponse;
    expect([200, 206]).toContain(publicResponse.status());
    expect(await publicResponse.json()).toHaveLength(10);
    await expect(
      consumer.getByRole("heading", { name: owner.username, exact: true }),
    ).toBeVisible();
    await expect(consumer.getByRole("article")).toHaveCount(10);
    for (const review of fixture.reviews.slice(0, 10)) {
      const card = consumer.getByRole("article").filter({
        has: consumer.getByRole("heading", {
          name: review.title,
          exact: true,
        }),
      });
      await expect(card.getByText(review.body, { exact: true })).toBeVisible();
      await expect(
        card.getByRole("link", { name: review.title, exact: true }),
      ).toHaveAttribute("href", `/manual-games/manual:${review.gameId}`);
    }
    const reviewNav = consumer.getByRole("navigation", {
      name: "Páginas de reseñas públicas",
    });
    await reviewNav.getByRole("button", { name: "Siguiente" }).click();
    await expect(consumer.getByRole("article")).toHaveCount(1);
    const finalReview = fixture.reviews[10];
    await expect(
      consumer.getByRole("heading", { name: finalReview.title, exact: true }),
    ).toBeVisible();
    await expect(
      consumer.getByText(finalReview.body, { exact: true }),
    ).toBeVisible();
    await expect(
      consumer.getByRole("link", { name: finalReview.title, exact: true }),
    ).toHaveAttribute("href", `/manual-games/manual:${finalReview.gameId}`);
    for (const review of fixture.reviews.slice(0, 10)) {
      await expect(
        consumer.getByRole("heading", { name: review.title, exact: true }),
      ).toHaveCount(0);
      await expect(
        consumer.getByText(review.body, { exact: true }),
      ).toHaveCount(0);
    }
    await expect(reviewNav.getByText("Página 2")).toBeVisible();
    await expect(
      reviewNav.getByRole("button", { name: "Siguiente" }),
    ).toBeDisabled();
  } finally {
    try {
      fixture?.cleanup();
    } finally {
      try {
        f.cleanup();
      } finally {
        await guestContext?.close();
      }
    }
  }
});
