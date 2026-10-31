import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { App } from "../../src/app/App";
import { CatalogPage } from "../../src/features/catalog/CatalogPage";
import { ServiceError } from "../../src/services/errors";
import { CuratedCatalogProvider } from "../../src/features/catalog/curated";
function renderApp(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe("Pantalla, router y adaptador", () => {
  it("busca un juego y abre su ficha con fuente", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("8 juegos encontrados");
    await user.type(screen.getByRole("searchbox"), "Hades");
    await user.click(await screen.findByRole("heading", { name: "Hades" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hades" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Sitio oficial/ })).toHaveAttribute(
      "href",
      "https://www.supergiantgames.com/games/hades/",
    );
  });
  it("muestra estado vacío y limpia filtros", async () => {
    const user = userEvent.setup();
    renderApp("/explore?q=zzzzz");
    expect(
      await screen.findByText("No encontramos juegos con esos filtros"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByText("8 juegos encontrados")).toBeVisible();
  });
  it("recupera el servicio tras error saneado", async () => {
    const user = userEvent.setup();
    const provider = new CuratedCatalogProvider();
    let fail = true;
    const search = provider.search.bind(provider);
    provider.search = async (q) => {
      if (fail)
        throw new ServiceError("unavailable", "Proveedor no disponible.");
      return search(q);
    };
    render(
      <MemoryRouter>
        <CatalogPage provider={provider} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Proveedor no disponible.",
    );
    fail = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("8 juegos encontrados");
  });
  it("cambia tema y lo conserva al recargar el componente", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    await user.selectOptions(screen.getByLabelText("Tema"), "light");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    expect(localStorage.getItem("gamehive-theme")).toBe("light");
  });
});

it("no muestra resultados anteriores al navegar por historial con proveedor lento", async () => {
  const { useNavigate } = await import("react-router-dom");
  let resolveSearch:
    | ((value: Awaited<ReturnType<CuratedCatalogProvider["search"]>>) => void)
    | undefined;
  const provider = new CuratedCatalogProvider(),
    original = provider.search.bind(provider);
  provider.search = async (query) =>
    query.text === "slow"
      ? new Promise((resolve) => {
          resolveSearch = resolve;
        })
      : original(query);
  function Navigation() {
    const navigate = useNavigate();
    return (
      <button onClick={() => navigate("/explore?q=slow")}>
        Ir a consulta lenta
      </button>
    );
  }
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/explore"]}>
      <Navigation />
      <CatalogPage provider={provider} />
    </MemoryRouter>,
  );
  await screen.findByText("8 juegos encontrados");
  await user.click(screen.getByRole("button", { name: "Ir a consulta lenta" }));
  expect(screen.getByRole("status")).toHaveTextContent("Buscando mundos");
  expect(screen.queryByText("8 juegos encontrados")).toBeNull();
  const { act } = await import("@testing-library/react");
  await act(async () =>
    resolveSearch?.({ items: [], total: 0, page: 1, pageSize: 6 }),
  );
  expect(await screen.findByText("0 juegos encontrados")).toBeVisible();
});
