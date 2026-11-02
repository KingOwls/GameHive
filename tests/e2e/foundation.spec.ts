import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("buscar → ficha → refrescar sin perder ruta", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("searchbox").fill("Hades");
  await page.getByRole("heading", { name: "Hades", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Hades" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: /Sitio oficial/ })).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Críticos", exact: true })
      .locator("..")
      .getByText(
        "Consulta los análisis publicados. Cálculo de puntuación crítica pendiente.",
        { exact: true },
      ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Consulta las reseñas publicadas. Cálculo de puntuación pendiente.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Las reseñas persistentes requieren una ficha real/),
  ).toBeVisible();
});
test("temas, preferencia de sistema, persistencia y movimiento reducido", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Tema").selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Tema").selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/design-system");
  await expect(page.locator(".hive-loader")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByLabel("Tema").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("accesibilidad automatizada en catálogo, detalle y vitrina, ambos temas", async ({
  page,
}) => {
  for (const theme of ["dark", "light"])
    for (const route of ["/explore", "/games/hades", "/design-system"]) {
      await page.goto(route);
      await page.getByLabel("Tema").selectOption(theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    }
});
test("teclado, estado vacío y ausencia de desbordamiento a 1280", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explore?q=noexiste");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "No encontramos juegos con esos filtros",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
