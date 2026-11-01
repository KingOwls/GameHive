import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AuthService } from "../../src/services/auth";
import type {
  Identity,
  PublicProfile,
  UserSettings,
} from "../../src/domain/models";
import { OnboardingPage } from "../../src/features/onboarding/OnboardingPage";
import { ThemeControl } from "../../src/app/ThemeControl";
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../src/features/auth/AuthContext", () => ({
  useAuth: () => auth.value,
}));
function profile(id: string): PublicProfile {
  return {
    id,
    username: id,
    bio: `bio-${id}`,
    avatar_key: "hive",
    reputation_score: 0,
    created_at: "2026-10-31",
  };
}
function settings(id: string): UserSettings {
  return {
    user_id: id,
    theme_mode: "dark",
    library_visibility: "private",
    platforms: ["PC"],
    genres: [],
    interests: `private-${id}`,
    onboarding_complete: true,
  };
}
function identity(id: string): Identity {
  return { id, role: "user", status: "active", criticVerified: false };
}
function setup() {
  const service = {
    identity: vi.fn().mockResolvedValue(identity("first")),
    profile: vi.fn(async (id: string) => profile(id)),
    settings: vi.fn(async (id: string) => settings(id)),
    updateProfile: vi.fn(),
    updateSettings: vi.fn(),
  };
  auth.value = {
    service: service as unknown as AuthService,
    session: { user: { id: "first" } },
    loading: false,
  };
  return service;
}
const view = () => (
  <MemoryRouter>
    <ThemeControl />
    <OnboardingPage />
  </MemoryRouter>
);
beforeEach(() => {
  localStorage.clear();
});
describe("onboarding account boundaries and preferences", () => {
  it("hides old private fields immediately during a delayed switch and after the next fetch fails", async () => {
    const service = setup(),
      user = userEvent.setup();
    const { rerender } = render(view());
    await screen.findByDisplayValue("private-first");
    await user.type(
      screen.getByLabelText("Biografía pública"),
      " unsaved private draft",
    );
    let resolve!: (value: Identity) => void;
    service.identity.mockImplementationOnce(
      () =>
        new Promise<Identity>((done) => {
          resolve = done;
        }),
    );
    auth.value = { ...auth.value, session: { user: { id: "second" } } };
    rerender(view());
    expect(screen.queryByLabelText("Biografía pública")).toBeNull();
    expect(screen.queryByDisplayValue("private-first")).toBeNull();
    await act(async () => resolve(identity("second")));
    await screen.findByDisplayValue("private-second");
    expect(screen.getByLabelText("Biografía pública")).toHaveValue(
      "bio-second",
    );
    service.identity.mockRejectedValueOnce(new Error("unavailable"));
    auth.value = { ...auth.value, session: { user: { id: "third" } } };
    rerender(view());
    expect(screen.queryByDisplayValue("private-second")).toBeNull();
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Biografía pública")).toBeNull();
  });
  it("reflects an acknowledged profile write even when settings fails, and never announces full success", async () => {
    const service = setup(),
      user = userEvent.setup();
    service.updateProfile.mockResolvedValue({
      ...profile("first"),
      avatar_key: "orbit",
      username: "updated",
    });
    service.updateSettings.mockRejectedValueOnce(new Error("network fault"));
    render(view());
    await screen.findByDisplayValue("private-first");
    await user.selectOptions(screen.getByLabelText("Avatar"), "orbit");
    await user.click(
      screen.getByRole("button", { name: "Guardar preferencias" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByAltText("Tu avatar GameHive")).toHaveAttribute(
      "src",
      "/avatars/orbit.svg",
    );
    expect(screen.queryByText("Perfil y preferencias guardados.")).toBeNull();
    service.updateSettings.mockResolvedValue(settings("first"));
    await user.click(
      screen.getByRole("button", { name: "Guardar preferencias" }),
    );
    await screen.findByText("Perfil y preferencias guardados.");
  });
  it("applies server theme on load/save and observes the existing storage contract", async () => {
    const service = setup(),
      user = userEvent.setup();
    service.updateProfile.mockResolvedValue(profile("first"));
    service.updateSettings.mockResolvedValue({
      ...settings("first"),
      theme_mode: "light",
    });
    render(view());
    await screen.findByDisplayValue("private-first");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "dark"),
    );
    await user.selectOptions(screen.getByLabelText("Tema preferido"), "light");
    await user.click(
      screen.getByRole("button", { name: "Guardar preferencias" }),
    );
    await screen.findByText("Perfil y preferencias guardados.");
    expect(localStorage.getItem("gamehive-theme")).toBe("light");
    expect(screen.getByLabelText("Tema", { exact: true })).toHaveValue("light");
    act(() => {
      localStorage.setItem("gamehive-theme", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "gamehive-theme",
          newValue: "dark",
        }),
      );
    });
    expect(screen.getByLabelText("Tema", { exact: true })).toHaveValue("dark");
  });
});
