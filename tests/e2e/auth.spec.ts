import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
// Auth traces can contain credentials; only sanitized assertions are retained.
test.use({ trace: "off", screenshot: "off", video: "off" });
test("auth without configuration is honest", async ({ page }) => {
  test.skip(
    process.env.GH_RUN_LOCAL === "1",
    "local environment is configured",
  );
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Autenticación sin configurar" }),
  ).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toHaveCount(0);
});
test("real registration → preferences → refresh → second browser → logout", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_LOCAL !== "1",
    "requires real local Supabase; run npm run test:backend -- --e2e",
  );
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12),
    email = `g1-browser-${suffix}@example.invalid`,
    password = `Gh1!${randomUUID()}`;
  const second = await browser.newContext({ colorScheme: "dark" });
  try {
    await page.goto("/register");
    await page.getByLabel("Alias público").fill(`Browser_${suffix}`);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu lugar en la colmena." }),
    ).toBeVisible();
    await page.getByLabel("PC", { exact: true }).check();
    await page
      .getByLabel("Estilo, narrativa y juegos que te interesan (privado)")
      .fill("Historias y estrategia");
    await page.getByLabel("Tema preferido").selectOption("light");
    await page.getByRole("button", { name: "Guardar preferencias" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Perfil y preferencias guardados.",
    );
    await page.reload();
    await expect(page.getByLabel("PC", { exact: true })).toBeChecked();
    await expect(
      page.getByLabel("Estilo, narrativa y juegos que te interesan (privado)"),
    ).toHaveValue("Historias y estrategia");
    const other = await second.newPage();
    await other.goto("/login");
    await other.getByLabel("Correo electrónico").fill(email);
    await other.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
    await other
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(other.getByRole("alert")).toContainText(
      "No pudimos iniciar sesión",
    );
    await other.getByLabel("Contraseña", { exact: true }).fill(password);
    await other
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(other.getByLabel("PC", { exact: true })).toBeChecked();
    await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
    await other.reload();
    await expect(other.getByLabel("Tema preferido")).toHaveValue("light");
    await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
    const profileA11y = await new AxeBuilder({ page: other })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(profileA11y.violations).toEqual([]);
    await page.route("**/auth/v1/logout*", (route) => route.abort());
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("button", { name: "Reintentar cierre" }),
    ).toBeVisible();
    await page.unroute("**/auth/v1/logout*");
    // The server revokes the session but its ACK is lost: retry must still clear
    // local credentials when the endpoint now reports an absent session.
    await page.route("**/auth/v1/logout*", async (route) => {
      await route.fetch();
      await route.abort();
    });
    await page.getByRole("button", { name: "Reintentar cierre" }).click();
    await expect(
      page.getByRole("button", { name: "Reintentar cierre" }),
    ).toBeVisible();
    await page.unroute("**/auth/v1/logout*");
    await page.getByRole("button", { name: "Reintentar cierre" }).click();
    await expect(
      page.getByRole("heading", { name: "Vuelve a la colmena." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Vuelve a la colmena." }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeVisible();
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
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: `update private.authz set status='suspended' where user_id=(select id from auth.users where email='${email}');`,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    await other.reload();
    await expect(
      other.getByRole("heading", { name: "Cuenta suspendida" }),
    ).toBeVisible();
    await expect(other.getByLabel("Biografía pública")).toHaveCount(0);
    await other.getByRole("button", { name: "Cerrar sesión" }).click();
  } finally {
    await second.close();
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
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: `delete from auth.users where email='${email}';`,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  }
});
