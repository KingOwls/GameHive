import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ManualCatalogPage } from "../../src/features/catalog/ManualCatalogPage";
import { ManualGameDetailPage } from "../../src/features/catalog/ManualGameDetailPage";
import { AdminGamesPage } from "../../src/features/admin/AdminGamesPage";
import type { ManualGamesService } from "../../src/services/manual-games";
vi.mock("../../src/features/reviews/ReviewsSection", () => ({
  ReviewsSection: () => null,
}));
const auth = vi.hoisted(() => ({
  value: {
    service: { identity: vi.fn() },
    session: { access_token: "fixture", user: { id: "admin-fixture" } },
    loading: false,
    error: "",
    retry: vi.fn(),
  },
}));
vi.mock("../../src/features/auth/AuthContext", () => ({
  useAuth: () => auth.value,
}));
const game = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Celeste",
  synopsis: "Madeline supera una montaña con desafíos de plataformas.",
  platforms: ["PC"],
  genres: ["Plataformas"],
  released_at: null,
  source_url: "https://www.celestegame.com/",
  source_label: "Sitio oficial Celeste",
  created_at: "2026-11-01",
};
const service = (): ManualGamesService => ({
  search: vi
    .fn()
    .mockResolvedValue({ items: [game], total: 1, page: 1, pageSize: 12 }),
  get: vi.fn().mockResolvedValue(game),
  create: vi.fn().mockResolvedValue(game),
});
it("manual list reports only its own count and public route", async () => {
  render(
    <MemoryRouter>
      <ManualCatalogPage service={service()} />
    </MemoryRouter>,
  );
  expect(await screen.findByText(/1 juegos manuales/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Celeste" })).toHaveAttribute(
    "href",
    `/manual-games/manual:${game.id}`,
  );
});
it("empty list explains absence limits", async () => {
  const games = service();
  vi.mocked(games.search).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
  });
  render(
    <MemoryRouter>
      <ManualCatalogPage service={games} />
    </MemoryRouter>,
  );
  expect(await screen.findByText(/no demuestra ausencia/)).toBeVisible();
});
it("public failure supports retry", async () => {
  const games = service();
  vi.mocked(games.search).mockRejectedValueOnce(new Error("private SQL error"));
  render(
    <MemoryRouter>
      <ManualCatalogPage service={games} />
    </MemoryRouter>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Reintentar" }),
  );
  expect(await screen.findByRole("link", { name: "Celeste" })).toBeVisible();
  expect(screen.queryByText(/private SQL/)).not.toBeInTheDocument();
});
it("detail renders source, explicit missing media and no score", async () => {
  render(
    <MemoryRouter initialEntries={[`/manual-games/manual:${game.id}`]}>
      <Routes>
        <Route
          path="/manual-games/:id"
          element={<ManualGameDetailPage service={service()} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("heading", { name: "Celeste" })).toBeVisible();
  expect(screen.getByText(/Sin portada · Sin rating externo/)).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Sinopsis propia" }),
  ).toBeVisible();
  expect(screen.getByText(game.synopsis)).toBeVisible();
  expect(screen.getByText("Plataformas", { selector: "dt" })).toBeVisible();
  expect(screen.getByText("PC", { selector: "dd" })).toBeVisible();
  expect(screen.getByText("Géneros")).toBeVisible();
  expect(screen.getByText("Plataformas", { selector: "dd" })).toBeVisible();
  expect(screen.getByText("Lanzamiento")).toBeVisible();
  expect(
    screen.getByText("Fecha no documentada", { selector: "dd" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Sitio oficial Celeste" }),
  ).toHaveAttribute("href", game.source_url);
});
it("missing detail is explicit", async () => {
  const games = service();
  vi.mocked(games.get).mockResolvedValue(null);
  render(
    <MemoryRouter>
      <ManualGameDetailPage service={games} />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Este juego manual no existe")).toBeVisible();
});
it.each(["user", "critic", "moderator"])(
  "denies visual admin form for %s",
  async (role) => {
    auth.value.service.identity.mockResolvedValue({ role, status: "active" });
    render(
      <MemoryRouter>
        <AdminGamesPage games={service()} />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("Acceso restringido a administradores activos"),
    ).toBeVisible();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  },
);
it("allows active administrator and requires source and private reason", async () => {
  auth.value.service.identity.mockResolvedValue({
    role: "admin",
    status: "active",
  });
  render(
    <MemoryRouter>
      <AdminGamesPage games={service()} />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText("Título")).toBeRequired();
  expect(screen.getByLabelText("Fuente oficial HTTPS")).toBeRequired();
  expect(screen.getByLabelText(/Motivo del alta/)).toBeRequired();
});

it("repeating the same query finishes another request", async () => {
  const games = service();
  render(
    <MemoryRouter initialEntries={["/manual-games?q=Celeste&page=1"]}>
      <ManualCatalogPage service={games} />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("link", { name: "Celeste" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await waitFor(() => expect(games.search).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("link", { name: "Celeste" })).toBeVisible();
  expect(
    screen.queryByText("Consultando juegos manuales"),
  ).not.toBeInTheDocument();
});
it("detail shows a documented date from an isolated fixture", async () => {
  const games = service();
  vi.mocked(games.get).mockResolvedValue({
    ...game,
    title: "Isolated date fixture",
    released_at: "2020-02-29",
  });
  render(
    <MemoryRouter>
      <ManualGameDetailPage service={games} />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText("2020-02-29", { selector: "dd" }),
  ).toBeVisible();
  expect(screen.queryByText("Fecha no documentada")).not.toBeInTheDocument();
  expect(screen.getByText(game.synopsis)).toBeVisible();
});
it("retains a draft after token refresh and resets it for another account", async () => {
  auth.value.session = { access_token: "initial", user: { id: "first-admin" } };
  auth.value.service.identity.mockResolvedValue({
    role: "admin",
    status: "active",
  });
  const games = service();
  const view = () => (
    <MemoryRouter>
      <AdminGamesPage games={games} />
    </MemoryRouter>
  );
  const rendered = render(view());
  await userEvent.type(
    await screen.findByLabelText("Título"),
    "Borrador sin guardar",
  );
  auth.value.session = {
    access_token: "refreshed",
    user: { id: "first-admin" },
  };
  rendered.rerender(view());
  await waitFor(() => expect(auth.value.service.identity).toHaveBeenCalled());
  expect(screen.getByLabelText("Título")).toHaveValue("Borrador sin guardar");
  auth.value.session = {
    access_token: "other-token",
    user: { id: "second-admin" },
  };
  rendered.rerender(view());
  expect(await screen.findByLabelText("Título")).toHaveValue("");
});
it.each([
  {
    platform: false,
    genres: "Plataformas",
    message: /Selecciona al menos una plataforma/,
  },
  {
    platform: true,
    genres: "a,b,c,d,e,f,g,h,i",
    message: /entre 1 y 8 géneros/,
  },
  { platform: true, genres: "x".repeat(41), message: /entre 1 y 8 géneros/ },
  { platform: true, genres: "RPG,,Acción", message: /entre 1 y 8 géneros/ },
])(
  "validates platform and genre limits before HTTP: %j",
  async ({ platform, genres, message }) => {
    auth.value.service.identity.mockResolvedValue({
      role: "admin",
      status: "active",
    });
    const games = service();
    render(
      <MemoryRouter>
        <AdminGamesPage games={games} />
      </MemoryRouter>,
    );
    await screen.findByLabelText("Título");
    if (platform) await userEvent.click(screen.getByLabelText("PC"));
    await userEvent.type(screen.getByLabelText(/Géneros separados/), genres);
    // Submit directly to isolate group validation from unrelated required fields.
    fireEvent.submit(
      screen.getByRole("button", { name: "Registrar juego" }).closest("form")!,
    );
    const control = platform
      ? screen.getByLabelText(/Géneros separados/)
      : screen.getByLabelText("PC");
    expect((control as HTMLInputElement).validationMessage).toMatch(message);
    expect(games.create).not.toHaveBeenCalled();
  },
);
