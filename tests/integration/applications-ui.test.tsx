import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CriticApplicationPage } from "../../src/features/critics/CriticApplicationPage";
import { CriticApplicationsPage } from "../../src/features/admin/CriticApplicationsPage";
import { AccountControl } from "../../src/features/auth/AccountControl";
import { NotificationsPage } from "../../src/features/notifications/NotificationsPage";
import {
  ApplicationsError,
  type CriticApplicationsService,
} from "../../src/services/critic-applications";
const auth = vi.hoisted(() => ({
  session: { user: { id: "71000000-0000-0000-0000-000000000001" } },
  loading: false,
  error: "",
  service: { identity: vi.fn() },
}));
vi.mock("../../src/features/auth/AuthContext", () => ({ useAuth: () => auth }));
const empty = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  eligible: true,
  hasPending: false,
  nextAllowedAt: null,
};
beforeEach(() => {
  sessionStorage.clear();
  auth.session.user.id = "71000000-0000-0000-0000-000000000001";
  auth.service.identity.mockReset();
  auth.service.identity.mockResolvedValue({ role: "admin", status: "active" });
});
describe("applications private UI and recovery", () => {
  it("preserves Unicode draft and verifies uncertain submit before allowing a retry", async () => {
    const user = userEvent.setup();
    const history = vi.fn().mockResolvedValue(empty),
      submit = vi
        .fn()
        .mockRejectedValue(
          new ApplicationsError(409, "Conflicto: consulta el estado guardado."),
        );
    const service = { history, submit } as unknown as CriticApplicationsService;
    const first = render(
      <MemoryRouter>
        <CriticApplicationPage applications={service} />
      </MemoryRouter>,
    );
    await screen.findByText("Aún no has presentado candidaturas");
    await user.type(
      screen.getByLabelText(/Procedencia o grupo/),
      "Independiente",
    );
    await user.type(
      screen.getByLabelText(/Experiencia/),
      "Experiencia propia de edición ".repeat(3),
    );
    await user.type(
      screen.getByLabelText(/Muestra textual/),
      "Muestra textual de crítica propia ".repeat(3),
    );
    await user.click(
      screen.getByRole("button", { name: "Presentar candidatura" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeDisabled();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Procedencia o grupo/)).toHaveValue(
      "Independiente",
    );
    history.mockResolvedValue({ ...empty, hasPending: true });
    await user.click(
      screen.getByRole("button", { name: "Consultar estado guardado" }),
    );
    await screen.findByText("Ya tienes una candidatura pendiente.");
    expect(submit).toHaveBeenCalledTimes(1);
    first.unmount();
    render(
      <MemoryRouter>
        <CriticApplicationPage applications={service} />
      </MemoryRouter>,
    );
    await screen.findByText("Ya tienes una candidatura pendiente.");
    expect(screen.getByLabelText(/Procedencia o grupo/)).toHaveValue(
      "Independiente",
    );
  });
  it("does not expose a different actor draft", async () => {
    sessionStorage.setItem(
      "gamehive:critic-application:other",
      JSON.stringify({
        organization: "Private evidence",
        experience: "secret",
        sample: "secret",
        links: [],
      }),
    );
    const service = {
      history: vi.fn().mockResolvedValue(empty),
    } as unknown as CriticApplicationsService;
    render(
      <MemoryRouter>
        <CriticApplicationPage applications={service} />
      </MemoryRouter>,
    );
    await screen.findByText("Aún no has presentado candidaturas");
    expect(screen.getByLabelText(/Procedencia o grupo/)).toHaveValue("");
  });
  it("guards admin queue before reading evidence", async () => {
    auth.service.identity.mockResolvedValue({
      role: "moderator",
      status: "active",
    });
    const queue = vi.fn();
    render(
      <MemoryRouter>
        <CriticApplicationsPage
          applications={{ queue } as unknown as CriticApplicationsService}
        />
      </MemoryRouter>,
    );
    await screen.findByText("Acceso restringido a administradores activos");
    expect(queue).not.toHaveBeenCalled();
  });
  it("preserves motivated admin decision after a conflict and checks the queue before retry", async () => {
    const user = userEvent.setup();
    const application = {
      id: "71000000-0000-0000-0000-000000000020",
      user_id: "71000000-0000-0000-0000-000000000002",
      organization: "Independiente",
      experience: "Experiencia editorial privada ".repeat(3),
      sample: "Muestra de análisis privada ".repeat(3),
      links: [],
      current_authority: {
        role: "user",
        status: "active",
        critic_verified: false,
      },
      expected_role: "user",
      expected_status: "active",
      expected_verified: false,
      status: "pending",
      version: 1,
      created_at: "2026-11-01",
      resolved_at: null,
      resolved_by: null,
      reason: null,
    };
    const queue = vi
      .fn()
      .mockResolvedValue({ ...empty, items: [application], total: 1 });
    const adminGet = vi.fn().mockResolvedValue({
      ...application,
      status: "rejected",
      version: 2,
      reason: "La resolución persistida por otro administrador",
      resolved_by: "71000000-0000-0000-0000-000000000003",
      resolved_at: "2026-11-02",
    });
    const resolve = vi
      .fn()
      .mockRejectedValue(new ApplicationsError(409, "La candidatura cambió."));
    render(
      <MemoryRouter>
        <CriticApplicationsPage
          applications={
            { queue, resolve, adminGet } as unknown as CriticApplicationsService
          }
        />
      </MemoryRouter>,
    );
    await screen.findByText(application.experience.trim());
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Decisión/ }),
      "rejected",
    );
    await user.type(
      screen.getByLabelText(/Motivo privado/),
      "La muestra necesita mayor profundidad editorial",
    );
    await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Guardar decisión" }),
    ).toBeDisabled();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Motivo privado/)).toHaveValue(
      "La muestra necesita mayor profundidad editorial",
    );
    queue.mockResolvedValue(empty);
    await user.click(
      screen.getByRole("button", { name: "Consultar cola guardada" }),
    );
    await screen.findByText("No hay candidaturas pendientes");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(adminGet).toHaveBeenCalledWith(
      application.id,
      expect.any(AbortSignal),
    );
    await screen.findByText("La resolución persistida por otro administrador", {
      exact: false,
    });
  });
  it("lets suspended session read and mark only supplied own notices", async () => {
    const notice = {
      id: "71000000-0000-0000-0000-000000000009",
      user_id: auth.session.user.id,
      application_id: "71000000-0000-0000-0000-000000000008",
      outcome: "rejected",
      reason: "La muestra requiere más detalle.",
      created_at: "2026-11-01",
      read_at: null,
    };
    const notices = vi
      .fn()
      .mockResolvedValueOnce({ ...empty, items: [notice], total: 1 })
      .mockResolvedValue({
        ...empty,
        items: [{ ...notice, read_at: "2026-11-02" }],
        total: 1,
      });
    const markRead = vi
      .fn()
      .mockResolvedValue({ ...notice, read_at: "2026-11-02" });
    render(
      <MemoryRouter>
        <NotificationsPage
          applications={
            { notices, markRead } as unknown as CriticApplicationsService
          }
        />
      </MemoryRouter>,
    );
    await screen.findByText(notice.reason);
    await userEvent.click(screen.getByRole("button", { name: "Marcar leído" }));
    await waitFor(() =>
      expect(markRead).toHaveBeenCalledWith(notice.id, expect.any(AbortSignal)),
    );
    await screen.findByText("Leído");
  });
});

const candidate = {
  id: "71000000-0000-0000-0000-000000000020",
  user_id: "71000000-0000-0000-0000-000000000002",
  organization: "Independiente",
  experience: "Evidencia privada de experiencia editorial propia",
  sample: "Muestra privada de análisis con profundidad suficiente",
  links: [],
  expected_role: "user",
  expected_status: "active",
  expected_verified: false,
  current_authority: { role: "user", status: "active", critic_verified: false },
  status: "pending",
  version: 1,
  created_at: "2026-11-01",
  resolved_at: null,
  resolved_by: null,
  reason: null,
};
it("restores rejection together with its reason and calls cancellation from the form", async () => {
  const user = userEvent.setup();
  const key = `gamehive:application-decision:${auth.session.user.id}:${candidate.id}`;
  sessionStorage.setItem(
    key,
    JSON.stringify({
      decision: "rejected",
      reason: "Motivo de rechazo restaurado",
    }),
  );
  const queue = vi
    .fn()
    .mockResolvedValue({ ...empty, items: [candidate], total: 1 });
  const service = {
    queue,
    cancel: vi.fn().mockResolvedValue({
      ...candidate,
      status: "cancelled",
      reason: "El sello de la cuenta cambió",
    }),
  } as unknown as CriticApplicationsService;
  const first = render(
    <MemoryRouter>
      <CriticApplicationsPage applications={service} />
    </MemoryRouter>,
  );
  await screen.findByDisplayValue("Motivo de rechazo restaurado");
  expect(screen.getByRole("combobox")).toHaveValue("rejected");
  first.unmount();
  queue.mockResolvedValue({
    ...empty,
    items: [
      {
        ...candidate,
        current_authority: {
          ...candidate.current_authority,
          critic_verified: true,
        },
      },
    ],
    total: 1,
  });
  render(
    <MemoryRouter>
      <CriticApplicationsPage applications={service} />
    </MemoryRouter>,
  );
  await screen.findByText(/Cambió el rol o sello/);
  await user.selectOptions(screen.getByRole("combobox"), "cancelled");
  await user.clear(screen.getByLabelText(/Motivo privado/));
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "El sello de la cuenta cambió",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await waitFor(() =>
    expect(service.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ id: candidate.id }),
      "El sello de la cuenta cambió",
      expect.any(AbortSignal),
    ),
  );
});
it("moves back from an emptied second page after a resolution", async () => {
  const user = userEvent.setup();
  const queue = vi
    .fn()
    .mockImplementation((page: number) =>
      Promise.resolve({ ...empty, page, total: 21, items: [candidate] }),
    );
  const service = {
    queue,
    resolve: vi.fn().mockResolvedValue({ ...candidate, status: "approved" }),
  } as unknown as CriticApplicationsService;
  render(
    <MemoryRouter>
      <CriticApplicationsPage applications={service} />
    </MemoryRouter>,
  );
  await screen.findByText(candidate.experience);
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Página 2", { exact: false });
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Decisión humana suficientemente motivada",
  );
  queue.mockImplementation((page: number) =>
    Promise.resolve({
      ...empty,
      page,
      total: 20,
      items:
        page === 2
          ? []
          : [{ ...candidate, id: "71000000-0000-0000-0000-000000000021" }],
    }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await screen.findByText("Página 1", { exact: false });
  expect(queue).toHaveBeenLastCalledWith(1, expect.any(AbortSignal));
  expect(
    screen.getByRole("button", { name: "Guardar decisión" }),
  ).toBeEnabled();
});
it.each([401, 403, 503])(
  "hides previous private notices after failed read %s",
  async (status) => {
    const user = userEvent.setup();
    const notice = {
      id: candidate.id,
      user_id: auth.session.user.id,
      application_id: candidate.id,
      outcome: "rejected",
      reason: "Aviso privado anterior",
      created_at: "2026-11-01",
      read_at: null,
    };
    const notices = vi
      .fn()
      .mockResolvedValueOnce({ ...empty, items: [notice], total: 1 })
      .mockRejectedValue(new ApplicationsError(status, "Lectura denegada"));
    const service = {
      notices,
      markRead: vi
        .fn()
        .mockRejectedValue(
          new ApplicationsError(503, "Consultar antes de reintentar"),
        ),
    } as unknown as CriticApplicationsService;
    render(
      <MemoryRouter>
        <NotificationsPage applications={service} />
      </MemoryRouter>,
    );
    await screen.findByText(notice.reason);
    await user.click(screen.getByRole("button", { name: "Marcar leído" }));
    await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", { name: "Consultar avisos guardados" }),
    );
    await screen.findByText("Lectura denegada");
    expect(screen.queryByText(notice.reason)).not.toBeInTheDocument();
  },
);
it("enables the mounted form exactly when the cooldown expires", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-07T00:00:00Z"));
    const history = vi.fn().mockResolvedValue({
      ...empty,
      nextAllowedAt: new Date(Date.now() + 1000).toISOString(),
    });
    await act(async () => {
      render(
        <MemoryRouter>
          <CriticApplicationPage
            applications={{ history } as unknown as CriticApplicationsService}
          />
        </MemoryRouter>,
      );
    });
    expect(
      screen.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(
      screen.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByRole("button", { name: "Presentar candidatura" }),
    ).toBeEnabled();
    expect(history).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
it("hides previous administrative evidence and stale identity after a denied identity refresh", async () => {
  const user = userEvent.setup();
  auth.service.identity
    .mockResolvedValueOnce({ role: "admin", status: "active" })
    .mockRejectedValue(new ApplicationsError(403, "Permiso retirado"));
  const queue = vi
    .fn()
    .mockResolvedValue({ ...empty, items: [candidate], total: 1 });
  const resolve = vi
    .fn()
    .mockRejectedValue(new ApplicationsError(409, "Consultar resolución"));
  render(
    <MemoryRouter>
      <CriticApplicationsPage
        applications={
          { queue, resolve } as unknown as CriticApplicationsService
        }
      />
    </MemoryRouter>,
  );
  await screen.findByText(candidate.sample);
  await user.selectOptions(screen.getByRole("combobox"), "rejected");
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Borrador privado que debe conservarse",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await screen.findByRole("alert");
  await user.click(
    screen.getByRole("button", { name: "Consultar cola guardada" }),
  );
  await screen.findByText("Permiso retirado");
  expect(screen.queryByText(candidate.sample)).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    JSON.parse(
      sessionStorage.getItem(
        `gamehive:application-decision:${auth.session.user.id}:${candidate.id}`,
      )!,
    ),
  ).toEqual({
    decision: "rejected",
    reason: "Borrador privado que debe conservarse",
  });
});
it("requires explicit review when exact recovery says the application is still pending", async () => {
  const user = userEvent.setup();
  const queue = vi
    .fn()
    .mockResolvedValue({ ...empty, items: [candidate], total: 1 });
  const resolve = vi
    .fn()
    .mockRejectedValue(new ApplicationsError(503, "Confirmación perdida"));
  const adminGet = vi.fn().mockResolvedValue(candidate);
  render(
    <MemoryRouter>
      <CriticApplicationsPage
        applications={
          { queue, resolve, adminGet } as unknown as CriticApplicationsService
        }
      />
    </MemoryRouter>,
  );
  await screen.findByText(candidate.sample);
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Decisión motivada todavía pendiente",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await screen.findByRole("alert");
  await user.click(
    screen.getByRole("button", { name: "Consultar cola guardada" }),
  );
  await screen.findByText(/La solicitud sigue pendiente/);
  expect(
    screen.getByRole("button", { name: "Guardar decisión" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Revisar decisión pendiente" }),
  );
  expect(
    screen.getByRole("button", { name: "Guardar decisión" }),
  ).toBeEnabled();
  expect(resolve).toHaveBeenCalledTimes(1);
});

it("retains exact recovery after adminGet succeeds but queue fails", async () => {
  const user = userEvent.setup();
  const saved = {
    ...candidate,
    status: "rejected",
    version: 2,
    reason: "Rechazo confirmado por otro administrador",
    resolved_by: "71000000-0000-0000-0000-000000000003",
    resolved_at: "2026-11-02",
  };
  const queue = vi
    .fn()
    .mockResolvedValueOnce({ ...empty, items: [candidate], total: 1 })
    .mockRejectedValueOnce(
      new ApplicationsError(503, "Cola temporalmente no disponible"),
    )
    .mockResolvedValue(empty);
  const adminGet = vi.fn().mockResolvedValue(saved);
  const resolve = vi
    .fn()
    .mockRejectedValue(
      new ApplicationsError(503, "Respuesta de escritura perdida"),
    );
  render(
    <MemoryRouter>
      <CriticApplicationsPage
        applications={
          { queue, adminGet, resolve } as unknown as CriticApplicationsService
        }
      />
    </MemoryRouter>,
  );
  await screen.findByText(candidate.sample);
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Decisión humana motivada para recuperar",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await screen.findByRole("alert");
  await user.click(
    screen.getByRole("button", { name: "Consultar cola guardada" }),
  );
  await screen.findByText("Cola temporalmente no disponible");
  expect(
    screen.queryByText(saved.reason, { exact: false }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Consultar cola guardada" }),
  );
  await screen.findByText(saved.reason, { exact: false });
  expect(adminGet).toHaveBeenCalledTimes(2);
  for (const call of adminGet.mock.calls) expect(call[0]).toBe(candidate.id);
  expect(resolve).toHaveBeenCalledTimes(1);
});

it.each([401, 403])(
  "hides administrative evidence immediately after a denied decision %s",
  async (status) => {
    const user = userEvent.setup();
    const queue = vi
      .fn()
      .mockResolvedValue({ ...empty, items: [candidate], total: 1 });
    const resolve = vi
      .fn()
      .mockRejectedValue(
        new ApplicationsError(status, "Permiso retirado al decidir"),
      );
    render(
      <MemoryRouter>
        <CriticApplicationsPage
          applications={
            { queue, resolve } as unknown as CriticApplicationsService
          }
        />
      </MemoryRouter>,
    );
    await screen.findByText(candidate.sample);
    await user.type(
      screen.getByLabelText(/Motivo privado/),
      "Decisión privada suficientemente motivada",
    );
    await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
    await screen.findByText("Permiso retirado al decidir");
    expect(screen.queryByText(candidate.sample)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      JSON.parse(
        sessionStorage.getItem(
          `gamehive:application-decision:${auth.session.user.id}:${candidate.id}`,
        )!,
      ),
    ).toMatchObject({ reason: "Decisión privada suficientemente motivada" });
  },
);

it("clears the previous result while a different decision is being saved", async () => {
  const user = userEvent.setup();
  const next = { ...candidate, id: "71000000-0000-0000-0000-000000000021" };
  const saved = {
    ...candidate,
    status: "approved",
    reason: "Primera decisión confirmada",
  };
  const queue = vi
    .fn()
    .mockResolvedValueOnce({ ...empty, items: [candidate], total: 1 })
    .mockResolvedValueOnce({ ...empty, items: [next], total: 1 })
    .mockResolvedValue(empty);
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const resolve = vi
    .fn()
    .mockResolvedValueOnce(saved)
    .mockReturnValueOnce(pending);
  render(
    <MemoryRouter>
      <CriticApplicationsPage
        applications={
          { queue, resolve } as unknown as CriticApplicationsService
        }
      />
    </MemoryRouter>,
  );
  await screen.findByText(candidate.sample);
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Primera decisión suficientemente motivada",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await screen.findByText(/Primera decisión confirmada/);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Guardar decisión" }),
    ).toBeEnabled(),
  );
  await user.type(
    screen.getByLabelText(/Motivo privado/),
    "Segunda decisión suficientemente motivada",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  expect(
    screen.queryByRole("region", { name: "Resultado consultado" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    finish({
      ...next,
      status: "rejected",
      reason: "Segunda decisión confirmada",
    });
  });
  await screen.findByText(/Segunda decisión confirmada/);
});

it.each([
  ["admin", "active", true],
  ["admin", "suspended", false],
  ["user", "active", false],
  ["critic", "active", false],
  ["moderator", "active", false],
])(
  "shows administrative navigation only for current active admin: %s/%s",
  async (role, status, visible) => {
    auth.service.identity.mockResolvedValue({ role, status });
    await act(async () => {
      render(
        <MemoryRouter>
          <AccountControl />
        </MemoryRouter>,
      );
    });
    const link = screen.queryByRole("link", { name: "Admisión de críticos" });
    if (visible) expect(link).toBeInTheDocument();
    else expect(link).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Solicitud de crítico" }),
    ).toBeInTheDocument();
  },
);

it("does not expose administrative navigation when current identity cannot be checked", async () => {
  auth.service.identity.mockRejectedValue(
    new ApplicationsError(503, "Identidad no disponible"),
  );
  await act(async () => {
    render(
      <MemoryRouter>
        <AccountControl />
      </MemoryRouter>,
    );
  });
  expect(
    screen.queryByRole("link", { name: "Admisión de críticos" }),
  ).not.toBeInTheDocument();
});
