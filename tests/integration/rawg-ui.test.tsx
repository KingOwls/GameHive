import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { it, expect, vi } from "vitest";
import type { CatalogProvider, Game } from "../../src/domain/models";
import { CatalogPage } from "../../src/features/catalog/CatalogPage";
import { GameDetailPage } from "../../src/features/catalog/GameDetailPage";
// Explicitly isolated provider fixtures, never a connection certification.
const fixture: Game = {
  id: "rawg:42",
  title: "Test fixture game",
  summary: "Test summary",
  description: "<script>unsafe()</script>",
  releasedYear: null,
  genres: ["RPG"],
  platforms: ["PC"],
  sourceUrl: "https://rawg.io/games/42",
  sourceLabel: "RAWG",
  externalRating: { value: 4.2, scale: 5, source: "RAWG", sample: 12 },
};
it("live filters come from server and combined URL survives navigation", async () => {
  const user = userEvent.setup();
  const search = vi
    .fn()
    .mockResolvedValue({ items: [fixture], total: 1, page: 2, pageSize: 12 });
  const provider: CatalogProvider = {
    mode: "live",
    search,
    get: async () => fixture,
    taxonomy: async () => ({
      genres: [{ id: "5", name: "Server RPG" }],
      platforms: [{ id: "1", name: "Server PC" }],
      tags: [{ id: "7", name: "Server tag" }],
    }),
  };
  render(
    <MemoryRouter
      initialEntries={[
        "/explore?q=Test&genre=5&platform=1&tag=7&year=2020&order=year&page=2",
      ]}
    >
      <CatalogPage provider={provider} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(screen.getByLabelText("Género")).toHaveValue("5");
  expect(screen.getByLabelText("Plataforma")).toHaveValue("1");
  expect(screen.getByLabelText("Etiqueta")).toHaveValue("7");
  expect(search.mock.calls.at(-1)?.[0]).toMatchObject({
    text: "Test",
    genre: "5",
    platform: "1",
    tag: "7",
    year: "2020",
    order: "year",
    page: 2,
  });
  search.mockClear();
  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "Hades");
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(search.mock.calls.at(-1)?.[0]).toMatchObject({
    text: "Hades",
    page: 1,
  });
  // One immediate cleared search plus one settled typed search, no per-character request.
  expect(search.mock.calls.length).toBeLessThanOrEqual(2);
  expect(screen.getByRole("link", { name: "RAWG" })).toHaveAttribute(
    "href",
    "https://rawg.io",
  );
  expect(screen.queryByText(/8 juegos reales/)).toBeNull();
});
it("detail retries errors, keeps external ratings separate and renders description as text", async () => {
  const user = userEvent.setup();
  let fail = true;
  const provider: CatalogProvider = {
    mode: "live",
    search: async () => ({ items: [], total: 0, page: 1, pageSize: 12 }),
    get: async () => {
      if (fail) throw new Error("secret URL");
      return fixture;
    },
  };
  const { container } = render(
    <MemoryRouter initialEntries={["/games/rawg:42"]}>
      <Routes>
        <Route
          path="/games/:id"
          element={<GameDetailPage provider={provider} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("alert");
  expect(screen.queryByText("secret URL")).toBeNull();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(screen.getByText("RAWG: 4.2 / 5 · muestra: 12")).toBeVisible();
  expect(screen.getAllByText("Sin evaluaciones")).toHaveLength(2);
  expect(screen.getByText("Sin fecha confirmada")).toBeVisible();
  await user.click(screen.getByText("Ficha completa"));
  expect(screen.getByText("<script>unsafe()</script>")).toBeVisible();
  expect(container.querySelector("script")).toBeNull();
});

it("screenshots load only in full detail and failure can retry independently", async () => {
  const user = userEvent.setup();
  let fail = true;
  const screenshots = vi.fn().mockImplementation(async () => {
    if (fail) throw new Error("secret upstream URL");
    return ["https://media.rawg.io/media/test.jpg"];
  });
  const provider: CatalogProvider = {
    mode: "live",
    search: async () => ({ items: [], total: 0, page: 1, pageSize: 12 }),
    get: async () => fixture,
    screenshots,
  };
  render(
    <MemoryRouter initialEntries={["/games/rawg:42"]}>
      <Routes>
        <Route
          path="/games/:id"
          element={<GameDetailPage provider={provider} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(screenshots).not.toHaveBeenCalled();
  await user.click(screen.getByText("Ficha completa"));
  await screen.findByText("No pudimos cargar las capturas");
  expect(
    screen.getByRole("heading", { name: "Test fixture game" }),
  ).toBeVisible();
  expect(screen.queryByText("secret upstream URL")).toBeNull();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Reintentar capturas" }));
  expect(
    await screen.findByAltText("Captura 1 de Test fixture game"),
  ).toHaveAttribute("src", "https://media.rawg.io/media/test.jpg");
});

it("ordinary year typing validates locally and retries search and taxonomy independently", async () => {
  const user = userEvent.setup();
  const taxonomyFails = false;
  let searchFails = false;
  const search = vi.fn().mockImplementation(async () => {
    if (searchFails) throw new Error("search");
    return { items: [fixture], total: 1, page: 1, pageSize: 12 };
  });
  const taxonomy = vi.fn().mockImplementation(async () => {
    if (taxonomyFails) throw new Error("taxonomy");
    return { genres: [], platforms: [], tags: [] };
  });
  const provider: CatalogProvider = {
    mode: "live",
    search,
    taxonomy,
    get: async () => fixture,
  };
  render(
    <MemoryRouter>
      <CatalogPage provider={provider} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Test fixture game" });
  search.mockClear();
  const year = screen.getByLabelText("Año");
  for (const value of ["2", "0", "2"]) {
    await user.type(year, value);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe un año completo",
    );
    expect(search).not.toHaveBeenCalled();
  }
  await user.type(year, "0");
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(search).toHaveBeenCalledOnce();
  expect(search.mock.calls[0][0].year).toBe("2020");
  const taxonomyCalls = taxonomy.mock.calls.length;
  searchFails = true;
  await user.selectOptions(screen.getByLabelText("Orden"), "year");
  await screen.findByRole("button", { name: "Reintentar" });
  searchFails = false;
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Test fixture game" });
  expect(taxonomy.mock.calls.length).toBe(taxonomyCalls);
});

it("taxonomy retry does not repeat the current search", async () => {
  const user = userEvent.setup();
  let fail = true;
  const search = vi
    .fn()
    .mockResolvedValue({ items: [fixture], total: 1, page: 1, pageSize: 12 });
  const taxonomy = vi.fn().mockImplementation(async () => {
    if (fail) throw new Error("taxonomy");
    return { genres: [], platforms: [], tags: [] };
  });
  const provider: CatalogProvider = {
    mode: "live",
    search,
    taxonomy,
    get: async () => fixture,
  };
  render(
    <MemoryRouter>
      <CatalogPage provider={provider} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Test fixture game" });
  await screen.findByRole("button", { name: "Reintentar filtros" });
  const calls = search.mock.calls.length;
  fail = false;
  await user.click(screen.getByRole("button", { name: "Reintentar filtros" }));
  expect(search.mock.calls.length).toBe(calls);
  expect(taxonomy).toHaveBeenCalledTimes(2);
});
