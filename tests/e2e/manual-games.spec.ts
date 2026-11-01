import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const db = (query: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_gamehive",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
test.use({ trace: "off", screenshot: "off", video: "off" });
test("admin real → alta Celeste → visitante → recarga y fuente", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_MANUAL !== "1",
    "Requiere Supabase local real: node scripts/local-manual-tests.mjs --e2e",
  );
  test.setTimeout(60000);
  const marker = "Manual_" + randomUUID().replaceAll("-", "").slice(0, 10),
    email = marker.toLowerCase() + "@example.invalid",
    password = "Gh2!" + randomUUID();
  const guest = await browser.newContext();
  const sourceUrl = `https://www.celestegame.com/?gamehive_fixture=${marker}`;
  const synopsis =
    "Juego de plataformas sobre el ascenso de Madeline a una montaña y sus desafíos personales.";
  try {
    await page.goto("/register");
    await page.getByLabel("Alias público").fill(marker);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu lugar en la colmena." }),
    ).toBeVisible();
    db(
      `update private.authz set role='admin' where user_id=(select id from auth.users where email='${email}');`,
    );
    await page.goto("/admin/games");
    await expect(
      page.getByRole("heading", { name: "Registrar juego real" }),
    ).toBeVisible();
    await page.getByLabel("Título", { exact: true }).fill("Celeste");
    await page.getByLabel("Sinopsis propia", { exact: true }).fill(synopsis);
    await page.getByLabel("PC", { exact: true }).check();
    await page.getByLabel(/Géneros separados/).fill("Plataformas");
    await page.getByLabel("Fuente oficial HTTPS").fill(sourceUrl);
    await page
      .getByLabel("Nombre de la fuente")
      .fill("Sitio oficial de Celeste");
    await page
      .getByLabel(/Motivo del alta/)
      .fill("Prueba de navegador local con fuente oficial documentada");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Registrar juego", exact: true })
      .click();
    const link = page.getByRole("link", {
      name: "Abrir ficha pública de Celeste",
    });
    await expect(link).toBeVisible();
    const route = await link.getAttribute("href");
    expect(route).toMatch(/^\/manual-games\/manual:[0-9a-f-]+$/);
    const publicPage = await guest.newPage();
    await publicPage.goto(route!);
    await expect(
      publicPage.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", { name: "Sitio oficial de Celeste" }),
    ).toHaveAttribute("href", sourceUrl);
    await expect(
      publicPage.getByText(
        "Sin portada · Sin rating externo",
      ),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page: publicPage })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: "Sinopsis propia" }),
    ).toBeVisible();
    await expect(publicPage.getByText(synopsis)).toBeVisible();
    await expect(
      publicPage.locator("dt").filter({ hasText: /^Plataformas$/ }),
    ).toBeVisible();
    await expect(
      publicPage.locator("dd").filter({ hasText: /^PC$/ }),
    ).toBeVisible();
    await expect(
      publicPage.locator("dt").filter({ hasText: /^Géneros$/ }),
    ).toBeVisible();
    await expect(
      publicPage.locator("dd").filter({ hasText: /^Plataformas$/ }),
    ).toBeVisible();
    await expect(
      publicPage.locator("dd").filter({ hasText: /^Fecha no documentada$/ }),
    ).toBeVisible();
    await publicPage.goto("/manual-games");
    const query = publicPage.getByRole("textbox", {
      name: "Buscar por título",
    });
    await query.fill(`No-match-${marker}`);
    await publicPage
      .getByRole("button", { name: "Buscar", exact: true })
      .click();
    await expect(
      publicPage.getByRole("heading", {
        name: "No hay resultados en este catálogo manual",
      }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", { name: "Celeste", exact: true }),
    ).toHaveCount(0);
    await query.fill("Celeste");
    await publicPage
      .getByRole("button", { name: "Buscar", exact: true })
      .click();
    // A previous legitimate Celeste record may also exist: open our exact ID.
    await publicPage.locator(`a[href="${route}"]`).click();
    await expect(
      publicPage.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    await publicPage.goto("/admin/games");
    await expect(
      publicPage.getByRole("heading", {
        name: "Inicia sesión como administrador",
      }),
    ).toBeVisible();
  } finally {
    db(`begin;
          select pg_advisory_xact_lock(718007013);
      delete from public.manual_games g where exists (
        select 1 from private.audit_logs a join auth.users u on u.id=a.actor_id
        where u.email='${email}' and a.action='manual_game.create'
        and a.after_data->>'gameId'='manual:'||g.id::text
      );
      delete from private.audit_logs where actor_id=(select id from auth.users where email='${email}');
      delete from auth.users where email='${email}';
      commit;`);
    expect(
      db(
        `select count(*) from public.manual_games where source_url='${sourceUrl}';`,
      ),
      "cleanup recovers committed ID without a link",
    ).toBe("0");
    expect(db(`select count(*) from auth.users where email='${email}';`)).toBe(
      "0",
    );
    await guest.close();
  }
});
