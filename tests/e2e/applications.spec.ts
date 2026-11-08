import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  applicationFixtures,
  applicationInput,
} from "../helpers/applications-local";
import { reviewApi, reviewPayload, reviewDb } from "../helpers/reviews-local";
import { criterionLabels, type CriticalOptions } from "../../src/domain/models";
import { criticalFixture } from "../helpers/critical";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("candidate → second session → admin → persisted result and private notice @applications", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_APPLICATIONS !== "1",
    "Requires test:applications -- --e2e",
  );
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const f = await applicationFixtures(true),
    contexts: BrowserContext[] = [];
  const [owner, other, , mod, admin] = f.accounts;
  const login = async (p: Page, a: typeof owner) => {
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
  try {
    console.log("Applications E2E: candidate login and submit");
    await login(page, owner);
    await page.goto("/critic/apply");
    await expect(
      page.getByText("Aún no has presentado candidaturas"),
    ).toBeVisible();
    await page
      .getByLabel(/Procedencia o grupo/)
      .fill(applicationInput.organization);
    await page.getByLabel(/Experiencia/).fill(applicationInput.experience);
    await page.getByLabel(/Muestra textual/).fill(applicationInput.sample);
    await page.getByLabel(/Enlaces HTTPS/).fill(applicationInput.links[0]);
    await page.getByRole("button", { name: "Presentar candidatura" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Ya tienes una candidatura pendiente."),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    console.log("Applications E2E: second session");
    const ctx = await browser.newContext();
    contexts.push(ctx);
    ctx.setDefaultTimeout(15000);
    ctx.setDefaultNavigationTimeout(20000);
    const second = await ctx.newPage();
    await login(second, owner);
    await second.goto("/critic/apply");
    await expect(
      second.getByRole("heading", { name: /Pendiente/ }),
    ).toBeVisible();
    console.log("Applications E2E: administrator decision");
    const adminCtx = await browser.newContext();
    contexts.push(adminCtx);
    adminCtx.setDefaultTimeout(15000);
    adminCtx.setDefaultNavigationTimeout(20000);
    const adminPage = await adminCtx.newPage();
    await login(adminPage, admin);
    await adminPage.goto("/admin/users");
    await expect(
      adminPage.getByText(applicationInput.experience),
    ).toBeVisible();
    let lostAck = false;
    await adminPage.route(
      "**/functions/v1/critic-applications",
      async (route) => {
        const body = route.request().postDataJSON() as {
          operation?: string;
        } | null;
        if (!lostAck && body?.operation === "resolve") {
          lostAck = true;
          const committed = await route.fetch();
          expect(committed.status()).toBe(200);
          await route.abort("failed");
        } else await route.continue();
      },
    );
    await adminPage
      .getByLabel(/Motivo privado/)
      .fill("Admisión motivada tras lectura de evidencia");
    await adminPage.getByRole("button", { name: "Guardar decisión" }).click();
    await expect(adminPage.getByRole("alert")).toBeVisible();
    await expect(
      adminPage.getByRole("button", { name: "Guardar decisión" }),
    ).toBeDisabled();
    await adminPage
      .getByRole("button", { name: "Consultar cola guardada" })
      .click();
    await expect(
      adminPage.getByRole("heading", { name: /Admitida/ }),
    ).toBeVisible();
    await expect(
      adminPage.getByText("No hay candidaturas pendientes"),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page: adminPage }).analyze()).violations,
    ).toEqual([]);
    await second.reload();
    await expect(
      second.getByRole("heading", { name: /Admitida/ }),
    ).toBeVisible();
    expect(
      reviewDb(
        `select role||':'||critic_verified from private.authz where user_id='${owner.id}'`,
      ),
    ).toBe("critic:true");
    console.log(
      "Applications E2E: freshly admitted session exercises real protected critical publication",
    );
    const gameId = `manual:${f.manualId}`;
    const options = await reviewApi(
      `/functions/v1/reviews?${new URLSearchParams({ gameId, questions: "1" })}`,
      owner.token,
    );
    expect(options.status).toBe(200);
    const critical = criticalFixture(options.data as CriticalOptions);
    await second.goto(`/manual-games/${gameId}`);
    await second
      .getByLabel("Título de la reseña")
      .fill("Análisis crítico desde la sesión recién admitida");
    await second
      .getByLabel("Opinión sin spoilers")
      .fill(reviewPayload.bodyPublic);
    await second
      .getByRole("button", { name: "Preparar análisis crítico completo" })
      .click();
    for (const [key, label] of Object.entries(criterionLabels)) {
      const criterion = critical.criteria[key as keyof typeof criterionLabels];
      await second
        .getByLabel(`Nota de ${label}`, { exact: true })
        .fill(String(criterion.score));
      await second
        .getByLabel(`Explicación de ${label}`, { exact: true })
        .fill(criterion.explanation);
    }
    await second.getByLabel("Horas jugadas").fill("25.5");
    await second.getByLabel("He finalizado el juego").check();
    await second
      .getByLabel("Justificación de la nota editorial")
      .fill(critical.scoreReason);
    for (const q of (options.data as CriticalOptions).questions)
      await second
        .getByLabel(`${q.prompt} (versión ${q.version})`, { exact: true })
        .fill("Respuesta editorial propia desde un navegador real.");
    await second
      .getByRole("button", { name: "Publicar reseña", exact: true })
      .click();
    await expect(
      second.getByText("Reseña guardada.", { exact: true }),
    ).toBeVisible();
    expect(
      reviewDb(
        `select kind||':'||critic_verified from public.reviews where author_id='${owner.id}' and manual_game_id='${f.manualId}'`,
      ),
    ).toBe("critic:true");
    await second.goto("/notifications");
    await expect(
      second.getByRole("heading", { name: "Candidatura admitida" }),
    ).toBeVisible();
    await second.getByRole("button", { name: "Marcar leído" }).click();
    await expect(second.getByText("Leído", { exact: true })).toBeVisible();
    expect(
      (await new AxeBuilder({ page: second }).analyze()).violations,
    ).toEqual([]);
    console.log(
      "Applications E2E: private notices and prior-seal user candidate",
    );
    reviewDb(
      `update private.authz set critic_verified=true where user_id='${other.id}'`,
    );
    const otherCtx = await browser.newContext();
    contexts.push(otherCtx);
    otherCtx.setDefaultTimeout(15000);
    otherCtx.setDefaultNavigationTimeout(20000);
    const outsider = await otherCtx.newPage();
    await login(outsider, other);
    await outsider.goto("/notifications");
    await expect(outsider.getByText("No tienes avisos")).toBeVisible();
    await outsider.goto("/critic/apply");
    await expect(
      outsider.getByText("Aún no has presentado candidaturas"),
    ).toBeVisible();
    await outsider.getByLabel(/Procedencia o grupo/).fill("Independiente");
    await outsider.getByLabel(/Experiencia/).fill(applicationInput.experience);
    await outsider.getByLabel(/Muestra textual/).fill(applicationInput.sample);
    await outsider
      .getByRole("button", { name: "Presentar candidatura" })
      .click();
    await expect(
      outsider.getByText("Ya tienes una candidatura pendiente."),
    ).toBeVisible();
    console.log("Applications E2E: reload admin rejection queue");
    await adminPage.reload();
    console.log("Applications E2E: select rejection");
    await adminPage
      .getByRole("combobox", { name: /Decisión/ })
      .selectOption("rejected");
    await adminPage
      .getByLabel(/Motivo privado/)
      .fill("La muestra requiere mayor profundidad editorial");
    await adminPage.getByRole("button", { name: "Guardar decisión" }).click();
    await expect(
      adminPage.getByText("No hay candidaturas pendientes"),
    ).toBeVisible();
    await outsider.reload();
    await expect(
      outsider.getByText(/Puedes volver a solicitar desde/),
    ).toBeVisible();
    await expect(
      outsider.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeDisabled();
    expect(
      reviewDb(
        `select role||':'||critic_verified from private.authz where user_id='${other.id}'`,
      ),
    ).toBe("user:true");
    await outsider.goto("/notifications");
    await expect(
      outsider.getByRole("heading", { name: "Candidatura rechazada" }),
    ).toBeVisible();
    console.log(
      "Applications E2E: cancellation screen, persisted history, notice and new application",
    );
    const unverified = f.accounts[2];
    const cancelCtx = await browser.newContext();
    contexts.push(cancelCtx);
    cancelCtx.setDefaultTimeout(15000);
    cancelCtx.setDefaultNavigationTimeout(20000);
    const cancelPage = await cancelCtx.newPage();
    await login(cancelPage, unverified);
    await cancelPage.goto("/critic/apply");
    await cancelPage
      .getByLabel(/Procedencia o grupo/)
      .fill("Independiente para anulación");
    await cancelPage
      .getByLabel(/Experiencia/)
      .fill(applicationInput.experience);
    await cancelPage
      .getByLabel(/Muestra textual/)
      .fill(applicationInput.sample);
    await cancelPage
      .getByRole("button", { name: "Presentar candidatura" })
      .click();
    await expect(
      cancelPage.getByText("Ya tienes una candidatura pendiente."),
    ).toBeVisible();
    reviewDb(
      `update private.authz set role='user' where user_id='${unverified.id}'`,
    );
    await adminPage.reload();
    await expect(adminPage.getByText(/Cambió el rol o sello/)).toBeVisible();
    await adminPage
      .getByRole("combobox", { name: /Decisión/ })
      .selectOption("cancelled");
    await adminPage
      .getByLabel(/Motivo privado/)
      .fill("El rol de la cuenta cambió antes de resolver");
    await adminPage.getByRole("button", { name: "Guardar decisión" }).click();
    await expect(
      adminPage.getByRole("heading", { name: /Anulada/ }),
    ).toBeVisible();
    await adminPage
      .getByRole("button", { name: "Ver historial administrativo" })
      .click();
    await expect(
      adminPage.getByRole("heading", { name: "Historial administrativo" }),
    ).toBeVisible();
    await cancelPage.reload();
    await expect(
      cancelPage.getByRole("heading", { name: /Anulada/ }),
    ).toBeVisible();
    await expect(
      cancelPage.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeEnabled();
    expect(
      reviewDb(
        `select role||':'||critic_verified from private.authz where user_id='${unverified.id}'`,
      ),
    ).toBe("user:false");
    await cancelPage.goto("/notifications");
    await expect(
      cancelPage.getByRole("heading", { name: "Candidatura anulada" }),
    ).toBeVisible();
    await cancelPage.goto("/critic/apply");
    await cancelPage
      .getByLabel(/Procedencia o grupo/)
      .fill("Independiente tras anulación");
    await cancelPage
      .getByLabel(/Experiencia/)
      .fill(applicationInput.experience);
    await cancelPage
      .getByLabel(/Muestra textual/)
      .fill(applicationInput.sample);
    await cancelPage
      .getByRole("button", { name: "Presentar candidatura" })
      .click();
    await expect(
      cancelPage.getByText("Ya tienes una candidatura pendiente."),
    ).toBeVisible();
    console.log("Applications E2E: moderator negative");
    const modCtx = await browser.newContext();
    contexts.push(modCtx);
    modCtx.setDefaultTimeout(15000);
    modCtx.setDefaultNavigationTimeout(20000);
    const modPage = await modCtx.newPage();
    await login(modPage, mod);
    await modPage.goto("/admin/users");
    await expect(
      modPage.getByText("Acceso restringido a administradores activos"),
    ).toBeVisible();
    await expect(modPage.getByText(applicationInput.sample)).toHaveCount(0);
  } catch (error) {
    console.log("Applications E2E: interaction failed before cleanup");
    throw error;
  } finally {
    console.log("Applications E2E: exact fixture cleanup");
    try {
      f.cleanup();
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close().catch(() => {})));
    }
  }
});
