import { describe, it, expect, vi } from "vitest";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LibraryPage } from "../../src/features/library/LibraryPage";
import { LibraryAction } from "../../src/features/library/LibraryAction";
import { LibraryError, type LibraryService } from "../../src/services/library";
const auth = vi.hoisted(() => ({
  session: { user: { id: "library_ui_actor" } },
}));
vi.mock("../../src/features/auth/AuthContext", () => ({ useAuth: () => auth }));
const entry = {
  id: "60000000-0000-0000-0000-000000000001",
  user_id: "60000000-0000-0000-0000-000000000002",
  game_id: "rawg:12",
  manual_game_id: null,
  state: null,
  favorite: false,
  interested: false,
  progress: null,
  version: 1,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const snapshot = (e: unknown) => ({
  entry: e,
  visibility: "private",
  visibilityVersion: 1,
});
describe("library drafts and uncertain acknowledgement", () => {
  it("preserves dirty base across remount and requires explicit reconciliation after a concurrent change", async () => {
    const user = userEvent.setup();
    const own = vi.fn().mockResolvedValue(snapshot(entry));
    const save = vi
      .fn()
      .mockRejectedValue(
        new LibraryError(409, "Conflicto; consulta el estado guardado."),
      );
    const service = { own, save } as unknown as LibraryService;
    const view = () => (
      <MemoryRouter>
        <LibraryAction gameId="rawg:12" service={service} />
      </MemoryRouter>
    );
    const first = render(view());
    await screen.findByText(
      "Estado guardado consultado. Tu borrador se conserva.",
    );
    await user.click(screen.getByLabelText("Favorito"));
    first.unmount();
    own.mockResolvedValue(
      snapshot({ ...entry, version: 2, state: "playing", progress: 40 }),
    );
    render(view());
    await screen.findByText(/El estado guardado cambió/);
    expect(screen.getByLabelText("Favorito")).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar en biblioteca" }),
    ).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", {
        name: "Aplicar borrador sobre la versión consultada",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar en biblioteca" }),
    );
    expect(save.mock.calls[0][2].version).toBe(2);
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Guardar en biblioteca" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Favorito")).toBeChecked();
  });
  it("does not offer curated games as persisted entries", () => {
    render(
      <MemoryRouter>
        <LibraryAction gameId="curated:test" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/no puede guardarse/)).toBeVisible();
  });
  it("does not replace confirmed public privacy with an older pending read", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    const settings = vi
      .fn()
      .mockResolvedValueOnce(snapshot(null))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const service = {
      settings,
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      privacy: vi.fn().mockResolvedValue({
        ...snapshot(null),
        visibility: "public",
        visibilityVersion: 2,
      }),
    } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryPage service={service} />
      </MemoryRouter>,
    );
    await screen.findByText("Privacidad actual: Privada");
    await user.click(screen.getByRole("button", { name: /^Buscar$/ }));
    await screen.findByText("0 juegos disponibles");
    await user.click(screen.getByRole("button", { name: /^Buscar$/ }));
    await screen.findByText("0 juegos disponibles");
    expect(service.search).toHaveBeenCalledTimes(3);

    await user.click(
      screen.getByRole("button", {
        name: "Consultar privacidad y estado guardados",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /^Publicar mi biblioteca$/,
      }),
    );
    await screen.findByText("Privacidad actual: Pública");
    await act(async () => resolve(snapshot(null)));
    expect(screen.getByText("Privacidad actual: Pública")).toBeVisible();
  });
  it("queries a lost acknowledgement without repeating the write or losing the draft", async () => {
    const user = userEvent.setup();
    const saved = { ...entry, game_id: "rawg:13", progress: 42 };
    const own = vi
      .fn()
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValue(snapshot(saved));
    const save = vi
      .fn()
      .mockRejectedValue(
        new LibraryError(
          503,
          "Resultado incierto. Consulta el estado guardado.",
        ),
      );
    const api = { own, save } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryAction gameId="rawg:13" service={api} />
      </MemoryRouter>,
    );
    await screen.findByText(
      "Estado guardado consultado. Tu borrador se conserva.",
    );
    await user.type(screen.getByLabelText("Progreso opcional (0–100)"), "42");
    await user.click(
      screen.getByRole("button", { name: "Guardar en biblioteca" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Guardar en biblioteca" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Consultar estado guardado" }),
    );
    await screen.findByRole("button", {
      name: "Aplicar borrador sobre la versión consultada",
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(own).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Progreso opcional (0–100)")).toHaveValue(42);
  });
  it("discards a settings read started during a pending privacy mutation", async () => {
    const user = userEvent.setup();
    let resolveRead!: (v: unknown) => void;
    let resolveWrite!: (v: unknown) => void;
    const settings = vi
      .fn()
      .mockResolvedValueOnce(snapshot(null))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveRead = done;
          }),
      );
    const api = {
      settings,
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      privacy: vi.fn().mockImplementation(
        () =>
          new Promise((done) => {
            resolveWrite = done;
          }),
      ),
    } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryPage service={api} />
      </MemoryRouter>,
    );
    await screen.findByText("Privacidad actual: Privada");
    await user.click(
      screen.getByRole("button", { name: /^Publicar mi biblioteca$/ }),
    );
    await user.click(screen.getByLabelText("Solo favoritos"));
    expect(settings).toHaveBeenCalledTimes(2);
    await act(async () =>
      resolveWrite({
        ...snapshot(null),
        visibility: "public",
        visibilityVersion: 2,
      }),
    );
    await screen.findByText("Privacidad actual: Pública");
    await act(async () => resolveRead(snapshot(null)));
    expect(screen.getByText("Privacidad actual: Pública")).toBeVisible();
  });
  it("retries a failed handle lookup through the existing retry control", async () => {
    const user = userEvent.setup();
    const profile = vi
      .fn()
      .mockRejectedValueOnce(new LibraryError(503, "Fallo de perfil"))
      .mockResolvedValue({
        id: "other-owner",
        username: "Retry_User",
        bio: "",
        avatar_key: "hive",
        created_at: "2026-01-01",
      });
    const api = {
      profile,
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as unknown as LibraryService;
    render(
      <MemoryRouter initialEntries={["/u/Retry_User/library"]}>
        <Routes>
          <Route
            path="/u/:handle/library"
            element={<LibraryPage service={api} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Fallo de perfil");
    await user.click(
      screen.getByRole("button", { name: "Reintentar consulta" }),
    );
    await screen.findByRole("link", { name: "Ver perfil público" });
    expect(profile).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Fallo de perfil")).toBeNull();
  });
  it("keeps a settings failure visible when a later list read succeeds", async () => {
    const user = userEvent.setup();
    let resolveList!: (v: unknown) => void;
    const api = {
      list: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((done) => {
              resolveList = done;
            }),
        )
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      settings: vi
        .fn()
        .mockRejectedValueOnce(
          new LibraryError(503, "Preferencias no disponibles"),
        )
        .mockResolvedValue(snapshot(null)),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryPage service={api} />
      </MemoryRouter>,
    );
    await screen.findByText("Preferencias no disponibles");
    await act(async () =>
      resolveList({ items: [], total: 0, page: 1, pageSize: 20 }),
    );
    expect(screen.getByText("Preferencias no disponibles")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Reintentar consulta" }),
    );
    await screen.findByText("Privacidad actual: Privada");
    expect(screen.queryByText("Preferencias no disponibles")).toBeNull();
  });
  it("returns to page one after removing the only item on page two", async () => {
    const user = userEvent.setup();
    let removed = false;
    const first = {
      ...entry,
      id: "60000000-0000-0000-0000-000000000031",
      game_id: "rawg:31",
      games: { document: { id: "rawg:31", title: "First matching game" } },
      manual_games: null,
    };
    const last = {
      ...entry,
      id: "60000000-0000-0000-0000-000000000032",
      game_id: "rawg:32",
      games: { document: { id: "rawg:32", title: "Final page game" } },
      manual_games: null,
    };
    const list = vi.fn(async (_owner: string, page: number) => ({
      items: page === 1 ? [first] : removed ? [] : [last],
      total: removed ? 20 : 21,
      page,
      pageSize: 20,
    }));
    const api = {
      list,
      settings: vi.fn().mockResolvedValue(snapshot(null)),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      own: vi.fn().mockResolvedValue(snapshot(last)),
      remove: vi.fn(async () => {
        removed = true;
        return snapshot(null);
      }),
    } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryPage service={api} />
      </MemoryRouter>,
    );
    await screen.findByText("21 juegos accesibles");
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Páginas de biblioteca" }),
      ).getByRole("button", { name: "Siguiente" }),
    );
    await screen.findByRole("heading", { name: "Final page game" });
    await user.click(
      screen.getByRole("button", { name: "Organizar este juego" }),
    );
    await screen.findByText(
      "Estado guardado consultado. Tu borrador se conserva.",
    );
    await user.click(
      screen.getByRole("button", { name: "Retirar de biblioteca" }),
    );
    await screen.findByRole("heading", { name: "First matching game" });
    expect(
      within(
        screen.getByRole("navigation", { name: "Páginas de biblioteca" }),
      ).getByText("Página 1"),
    ).toBeVisible();
    expect(screen.getByText("20 juegos accesibles")).toBeVisible();
    expect(screen.queryByText("No hay juegos con estos filtros")).toBeNull();
    expect(list.mock.calls.map((call) => call[1])).toEqual([1, 2, 2, 1]);
  });
  it("preserves each dirty organizer when another organizer saves the same actor and game", async () => {
    const user = userEvent.setup();
    const base = { ...entry, game_id: "rawg:41" };
    const updated = { ...base, version: 2, favorite: true };
    const own = vi.fn().mockResolvedValue(snapshot(base));
    const save = vi
      .fn()
      .mockResolvedValueOnce(snapshot(updated))
      .mockRejectedValueOnce(new LibraryError(409, "Conflicto entre editores"));
    const api = { own, save } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryAction gameId="rawg:41" service={api} />
        <LibraryAction gameId="rawg:41" service={api} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(
          "Estado guardado consultado. Tu borrador se conserva.",
        ),
      ).toHaveLength(2),
    );
    const [a, b] = screen
      .getAllByRole("region", { name: "Guardar juego en biblioteca" })
      .map((el) => within(el));
    await user.click(b.getByLabelText("Me interesa"));
    await user.type(b.getByLabelText("Progreso opcional (0–100)"), "77");
    // A now owns the shared storage slot and deletes it on success; B must
    // preserve its separate dirty marks/base without relying on that slot.
    await user.click(a.getByLabelText("Favorito"));
    await user.click(a.getByRole("button", { name: "Guardar en biblioteca" }));
    await a.findByText("Juego guardado en tu biblioteca.");
    await user.click(b.getByRole("button", { name: "Guardar en biblioteca" }));
    await b.findByText("Conflicto entre editores");
    own.mockResolvedValue(snapshot(updated));
    await user.click(
      b.getByRole("button", { name: "Consultar estado guardado" }),
    );
    await b.findByRole("button", {
      name: "Aplicar borrador sobre la versión consultada",
    });
    expect(b.getByLabelText("Me interesa")).toBeChecked();
    expect(b.getByLabelText("Favorito")).not.toBeChecked();
    expect(b.getByLabelText("Progreso opcional (0–100)")).toHaveValue(77);
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("keeps a list failure visible after a successful privacy mutation", async () => {
    const user = userEvent.setup();
    const api = {
      list: vi
        .fn()
        .mockRejectedValue(new LibraryError(503, "Listado no disponible")),
      settings: vi.fn().mockResolvedValue(snapshot(null)),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      privacy: vi.fn().mockResolvedValue({
        ...snapshot(null),
        visibility: "public",
        visibilityVersion: 2,
      }),
    } as unknown as LibraryService;
    render(
      <MemoryRouter>
        <LibraryPage service={api} />
      </MemoryRouter>,
    );
    await screen.findByText("Listado no disponible");
    await user.click(
      screen.getByRole("button", { name: "Publicar mi biblioteca" }),
    );
    await screen.findByText("Privacidad actual: Pública");
    expect(screen.getByText("Listado no disponible")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reintentar consulta" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: "Cargando biblioteca" }),
    ).toBeNull();
  });
});
