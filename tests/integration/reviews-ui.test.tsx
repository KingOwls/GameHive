import { beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ReviewsSection } from "../../src/features/reviews/ReviewsSection";
import type { Review } from "../../src/domain/models";
import type { ReviewsService } from "../../src/services/reviews";
import { ReviewError } from "../../src/services/reviews";
const auth = vi.hoisted(() => ({
  session: { access_token: "fixture", user: { id: "owner" } },
  service: { identity: vi.fn() },
  loading: false,
}));
vi.mock("../../src/features/auth/AuthContext", () => ({ useAuth: () => auth }));
const review: Review = {
  id: "review-1",
  author_id: "owner",
  game_id: "rawg:42",
  manual_game_id: null,
  rating: 7,
  title: "Buena aventura",
  body_public: "Una aventura con combate preciso y exploración.",
  body_spoiler: "El final secreto",
  pros: ["Combate"],
  cons: [],
  status: "published",
  version: 1,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
function service(): ReviewsService {
  return {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          ...review,
          profiles: { username: "AliasPublico", avatar_key: "hive" },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    }),
    own: vi.fn().mockResolvedValue(review),
    mutate: vi.fn().mockResolvedValue({ ...review, version: 2 }),
  };
}
function view(service: ReviewsService, gameId = "rawg:42") {
  return (
    <MemoryRouter>
      <ReviewsSection gameId={gameId} service={service} />
    </MemoryRouter>
  );
}
beforeEach(() => {
  sessionStorage.clear();
  auth.service.identity.mockReset();
  auth.session = { access_token: "fixture", user: { id: "owner" } };
  auth.service.identity.mockResolvedValue({
    id: "owner",
    role: "user",
    status: "active",
    criticVerified: false,
  });
});
it("renders actual count and public alias, escapes XSS and keeps spoilers closed", async () => {
  const s = service();
  vi.mocked(s.list).mockResolvedValue({
    items: [
      {
        ...review,
        title: "<script>evil()</script>",
        profiles: { username: "AliasPublico", avatar_key: "orbit" },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
  });
  const { container } = render(view(s));
  expect(await screen.findByText(/1 reseña publicada · Cálculo/)).toBeVisible();
  expect(screen.getByText(/AliasPublico/)).toBeVisible();
  expect(screen.getByText("<script>evil()</script>")).toBeVisible();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.queryByText("El final secreto", { selector: "p" })).toBeNull();
  const button = screen.getByRole("button", { name: "Mostrar spoilers" });
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByText("El final secreto", { selector: "p" })).toBeVisible();
  expect(button).toHaveAttribute("aria-expanded", "true");
});
it("409 retains draft and original version through remount until explicit reload", async () => {
  const s = service();
  vi.mocked(s.mutate).mockRejectedValue(
    new ReviewError(409, "Conflicto de versión."),
  );
  const mounted = render(view(s));
  await screen.findByLabelText("Opinión sin spoilers");
  fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
    target: { value: "Borrador nuevo que debe sobrevivir al conflicto." },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar cambios de reseña" }),
  );
  await screen.findByText("Conflicto de versión.");
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    "Borrador nuevo que debe sobrevivir al conflicto.",
  );
  mounted.unmount();
  vi.mocked(s.own).mockResolvedValue({
    ...review,
    version: 2,
    body_public: "La edición de otra sesión se mantiene guardada.",
  });
  render(view(s));
  await screen.findByLabelText("Opinión sin spoilers");
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    "Borrador nuevo que debe sobrevivir al conflicto.",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar cambios de reseña" }),
  );
  await waitFor(() =>
    expect(s.mutate).toHaveBeenLastCalledWith(
      "update",
      "rawg:42",
      1,
      expect.objectContaining({
        bodyPublic: "Borrador nuevo que debe sobrevivir al conflicto.",
      }),
    ),
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Cargar versión guardada y descartar borrador",
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
      "La edición de otra sesión se mantiene guardada.",
    ),
  );
});
it("token refresh keeps draft while switching author isolates storage", async () => {
  const s = service();
  const mounted = render(view(s));
  await screen.findByLabelText("Título de la reseña");
  fireEvent.change(screen.getByLabelText("Título de la reseña"), {
    target: { value: "Borrador propio" },
  });
  auth.session = { access_token: "new-token", user: { id: "owner" } };
  mounted.rerender(view(s));
  expect(screen.getByLabelText("Título de la reseña")).toHaveValue(
    "Borrador propio",
  );
  auth.session = { access_token: "other-token", user: { id: "other" } };
  vi.mocked(s.own).mockResolvedValue(null);
  mounted.rerender(view(s));
  await waitFor(() =>
    expect(screen.getByLabelText("Título de la reseña")).toHaveValue(""),
  );
});
it("rating change with whitespace only public change never calls mutation", async () => {
  const s = service();
  render(view(s));
  await screen.findByLabelText("Nota (0–10)");
  fireEvent.change(screen.getByLabelText("Nota (0–10)"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
    target: { value: review.body_public.replaceAll(" ", "  ") },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar cambios de reseña" }),
  );
  expect(await screen.findByText(/Actualiza también tu opinión/)).toBeVisible();
  expect(s.mutate).not.toHaveBeenCalled();
});
it("offline identities never request persisted data", () => {
  const s = service();
  render(view(s, "hollow-knight"));
  expect(screen.getByText(/requieren una ficha real/)).toBeVisible();
  expect(s.list).not.toHaveBeenCalled();
  expect(s.own).not.toHaveBeenCalled();
});
it.each(["admin", "moderator", "critic"])(
  "blocks write form for %s",
  async (role) => {
    auth.service.identity.mockResolvedValue({ role, status: "active" });
    render(view(service()));
    expect(
      await screen.findByText(/Solo las cuentas de jugador activas/),
    ).toBeVisible();
    expect(screen.queryByLabelText("Título de la reseña")).toBeNull();
  },
);
it("moderated owner cannot restore or edit", async () => {
  const s = service();
  vi.mocked(s.own).mockResolvedValue({ ...review, status: "hidden" });
  render(view(s));
  expect(await screen.findByText(/oculta por moderación/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Republicar reseña" }),
  ).toBeNull();
  expect(screen.queryByLabelText("Título de la reseña")).toBeNull();
});
it("public pagination uses actual page count and reloads closed spoilers", async () => {
  const s = service();
  vi.mocked(s.list).mockResolvedValue({
    items: [{ ...review, profiles: { username: "Alias", avatar_key: "hive" } }],
    total: 11,
    page: 1,
    pageSize: 10,
  });
  render(view(s));
  await screen.findByRole("button", { name: "Reseñas siguientes" });
  await userEvent.click(
    screen.getByRole("button", { name: "Mostrar spoilers" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reseñas siguientes" }),
  );
  await waitFor(() =>
    expect(s.list).toHaveBeenLastCalledWith(
      "rawg:42",
      2,
      expect.any(AbortSignal),
    ),
  );
  expect(
    await screen.findByRole("button", { name: "Mostrar spoilers" }),
  ).toBeVisible();
});

it("retries both authority and own review after a transient initial failure", async () => {
  const s = service();
  auth.service.identity.mockRejectedValueOnce(new Error("private failure"));
  render(view(s));
  await userEvent.click(
    await screen.findByRole("button", { name: "Reintentar permisos y reseña" }),
  );
  expect(await screen.findByLabelText("Título de la reseña")).toHaveValue(
    review.title,
  );
  expect(auth.service.identity).toHaveBeenCalledTimes(2);
  expect(s.own).toHaveBeenCalledTimes(2);
});

it("restores an unfinished rating alongside the text draft after refresh", async () => {
  const s = service();
  const mounted = render(view(s));
  await screen.findByLabelText("Nota (0–10)");
  fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
    target: { value: "Borrador con nota aún pendiente de completar." },
  });
  fireEvent.change(screen.getByLabelText("Nota (0–10)"), {
    target: { value: "" },
  });
  mounted.unmount();
  render(view(s));
  await screen.findByLabelText("Nota (0–10)");
  expect(screen.getByLabelText("Nota (0–10)")).toHaveValue(null);
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    "Borrador con nota aún pendiente de completar.",
  );
});

it.each([502, 503, 504])(
  "requires saved-state checking before retrying uncertain%s",
  async (status) => {
    const s = service();
    vi.mocked(s.mutate).mockRejectedValueOnce(
      new ReviewError(
        status,
        "Comprueba tu reseña guardada antes de reintentar.",
      ),
    );
    render(view(s));
    await screen.findByLabelText("Opinión sin spoilers");
    fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
      target: {
        value: "Borrador conservado después de un resultado incierto.",
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de reseña" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Guardar cambios de reseña" }),
      ).toBeDisabled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Comprobar reseña guardada" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Guardar cambios de reseña" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
      "Borrador conservado después de un resultado incierto.",
    );
  },
);

it("preserves unsaved input and its storage through withdraw, republish and remount", async () => {
  const s = service();
  vi.mocked(s.mutate)
    .mockResolvedValueOnce({ ...review, status: "withdrawn", version: 2 })
    .mockResolvedValueOnce({ ...review, status: "published", version: 3 });
  let mounted = render(view(s));
  await screen.findByLabelText("Título de la reseña");
  fireEvent.change(screen.getByLabelText("Título de la reseña"), {
    target: { value: "Título aún sin guardar" },
  });
  fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
    target: { value: "Una opinión nueva que permanece sin guardar." },
  });
  fireEvent.change(screen.getByLabelText("Nota (0–10)"), {
    target: { value: "8" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Retirar reseña" }));
  await screen.findByText(/Estado: retirada/);
  expect(screen.getByLabelText("Título de la reseña")).toHaveValue(
    "Título aún sin guardar",
  );
  mounted.unmount();
  vi.mocked(s.own).mockResolvedValue({
    ...review,
    status: "withdrawn",
    version: 2,
  });
  mounted = render(view(s));
  await screen.findByLabelText("Título de la reseña");
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    "Una opinión nueva que permanece sin guardar.",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Republicar reseña" }),
  );
  await screen.findByText(/Estado: publicada · Versión guardada: 3/);
  mounted.unmount();
  vi.mocked(s.own).mockResolvedValue({ ...review, version: 3 });
  render(view(s));
  await screen.findByLabelText("Título de la reseña");
  expect(screen.getByLabelText("Título de la reseña")).toHaveValue(
    "Título aún sin guardar",
  );
  expect(screen.getByLabelText("Nota (0–10)")).toHaveValue(8);
  expect(
    JSON.parse(sessionStorage.getItem("gamehive:review-draft:owner:rawg:42")!),
  ).toMatchObject({
    version: 3,
    baseline: { rating: 7, bodyPublic: review.body_public },
    input: { rating: 8, title: "Título aún sin guardar" },
  });
});
it("disables every editor field until a held mutation resolves", async () => {
  const s = service();
  let resolve!: (value: Review) => void;
  vi.mocked(s.mutate).mockReturnValue(
    new Promise<Review>((done) => {
      resolve = done;
    }),
  );
  render(view(s));
  await screen.findByLabelText("Opinión sin spoilers");
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar cambios de reseña" }),
  );
  for (const control of [
    ...screen.getAllByRole("textbox"),
    screen.getByLabelText("Nota (0–10)"),
  ])
    expect(control).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Opinión sin spoilers"),
    "Later typing",
  );
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    review.body_public,
  );
  await act(async () => resolve({ ...review, version: 2 }));
  expect(screen.getByLabelText("Opinión sin spoilers")).toBeEnabled();
  expect(screen.getByLabelText("Opinión sin spoilers")).toHaveValue(
    review.body_public,
  );
});
it("saved-state checking refreshes current identity and public visibility while retaining the original draft version", async () => {
  const s = service();
  render(view(s));
  await screen.findByLabelText("Opinión sin spoilers");
  fireEvent.change(screen.getByLabelText("Opinión sin spoilers"), {
    target: { value: "Una opinión nueva conservada tras comprobar estado." },
  });
  vi.mocked(s.own).mockResolvedValue({
    ...review,
    status: "withdrawn",
    version: 9,
  });
  vi.mocked(s.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  auth.service.identity.mockResolvedValue({
    id: "owner",
    role: "moderator",
    status: "active",
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Comprobar reseña guardada" }),
  );
  expect(await screen.findByText("Sin evaluaciones GameHive")).toBeVisible();
  expect(
    await screen.findByText(/Solo las cuentas de jugador activas/),
  ).toBeVisible();
  expect(screen.queryByLabelText("Opinión sin spoilers")).toBeNull();
  expect(
    JSON.parse(sessionStorage.getItem("gamehive:review-draft:owner:rawg:42")!),
  ).toMatchObject({
    version: 1,
    input: {
      bodyPublic: "Una opinión nueva conservada tras comprobar estado.",
    },
  });
  auth.service.identity.mockResolvedValue({
    id: "owner",
    role: "user",
    status: "active",
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Comprobar reseña guardada" }),
  );
  await screen.findByLabelText("Opinión sin spoilers");
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar cambios de reseña" }),
  );
  expect(s.mutate).toHaveBeenCalledWith(
    "update",
    "rawg:42",
    1,
    expect.objectContaining({
      bodyPublic: "Una opinión nueva conservada tras comprobar estado.",
    }),
  );
});
it.each([401, 403])(
  "clears stale write permission on saved-state%s and still refreshes the public list",
  async (status) => {
    const s = service();
    render(view(s));
    await screen.findByLabelText("Título de la reseña");
    vi.mocked(s.own).mockRejectedValueOnce(
      new ReviewError(status, "Sesión sin permiso."),
    );
    vi.mocked(s.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Comprobar reseña guardada" }),
    );
    expect(await screen.findByText("Sin evaluaciones GameHive")).toBeVisible();
    expect(screen.queryByLabelText("Título de la reseña")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Reintentar permisos y reseña" }),
    ).toBeVisible();
  },
);
it("keeps page101 reachable when the exact count exceeds1000", async () => {
  const s = service();
  vi.mocked(s.list).mockResolvedValue({
    items: [],
    total: 1010,
    page: 1,
    pageSize: 10,
  });
  render(view(s));
  for (let page = 2; page <= 101; page++) {
    await userEvent.click(
      await screen.findByRole("button", { name: "Reseñas siguientes" }),
    );
    await screen.findByText(`Página ${page}`);
  }
  expect(s.list).toHaveBeenLastCalledWith(
    "rawg:42",
    101,
    expect.any(AbortSignal),
  );
  expect(
    screen.getByRole("button", { name: "Reseñas siguientes" }),
  ).toBeDisabled();
}, 15000);

it.each([
  ["Título de la reseña", 120],
  ["Opinión sin spoilers", 10000],
  ["Spoilers opcionales", 20000],
] as const)(
  "synchronizes %s validity after restoring an invalid draft and explicitly loading saved content",
  async (label, max) => {
    const s = service();
    let mounted = render(view(s));
    const control = (await screen.findByLabelText(label)) as
      HTMLInputElement | HTMLTextAreaElement;
    fireEvent.change(control, { target: { value: "😀".repeat(max + 1) } });
    expect(control.validity.customError).toBe(true);
    mounted.unmount();
    mounted = render(view(s));
    const restored = (await screen.findByLabelText(label)) as
      HTMLInputElement | HTMLTextAreaElement;
    expect([...restored.value]).toHaveLength(max + 1);
    expect(restored.validity.customError).toBe(true);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Cargar versión guardada y descartar borrador",
      }),
    );
    await screen.findByText("Versión guardada cargada.");
    const saved = screen.getByLabelText(label) as
      HTMLInputElement | HTMLTextAreaElement;
    expect(saved.validity.customError).toBe(false);
    expect(saved.closest("form")!.checkValidity()).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de reseña" }),
    );
    expect(s.mutate).toHaveBeenCalledWith(
      "update",
      "rawg:42",
      1,
      expect.objectContaining({
        title: review.title,
        bodyPublic: review.body_public,
        bodySpoiler: review.body_spoiler,
      }),
    );
  },
);
