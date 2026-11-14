import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ trace: "off", screenshot: "off", video: "off" });
test("RAWG real: buscar → ficha → capturas → refrescar", async ({ page }) => {
  test.skip(
    process.env.GH_RUN_RAWG !== "1",
    "Requiere backend local con clave RAWG real; sin mocks",
  );
  test.setTimeout(60000);
  await page.goto("/explore?q=Hollow%20Knight&order=title");
  await expect(page.getByText("Catálogo RAWG", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("Hollow Knight");
  await page
    .getByRole("heading", { name: "Hollow Knight", exact: true, level: 2 })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hollow Knight", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Sin evaluaciones", { exact: true })).toHaveCount(
    2,
  );
  await expect(page.getByText(/RAWG: .* \/ 5 · muestra:/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "RAWG ↗", exact: true }),
  ).toHaveAttribute("href", "https://rawg.io/games/hollow-knight");
  await page.getByText("Ficha completa", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Requisitos por plataforma" }),
  ).toBeVisible();
  await expect(page.getByText(/Desarrollador: Team Cherry/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Captura 1 de Hollow Knight" }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hollow Knight", exact: true, level: 1 }),
  ).toBeVisible();
});
