import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpoilerReveal } from "../../src/components/SpoilerReveal";
import { parsePublicConfig } from "../../src/services/config";
import { publicError } from "../../src/services/errors";
describe("Frontera cliente; no certifica RLS", () => {
  it("oculta spoilers y escapa HTML sin ejecutarlo", async () => {
    const user = userEvent.setup(),
      payload = "<img src=x onerror=alert(1)>";
    const { container } = render(<SpoilerReveal text={payload} />);
    expect(screen.queryByText(payload)).toBeNull();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText(payload)).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });
  it("sanea errores desconocidos sin filtrar tokens", () =>
    expect(publicError(new Error("secret_token"))).not.toContain(
      "secret_token",
    ));
  it("admite entorno sin configurar sin simular conexión", () =>
    expect(parsePublicConfig({})).toBeNull());
  it.each(["sb_secret_private", "service_role", "eyJ.legacy.jwt"])(
    "rechaza clave privada o heredada %s",
    (key) =>
      expect(() =>
        parsePublicConfig({
          VITE_SUPABASE_URL: "https://example.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow(),
  );
  it("rechaza http remoto y acepta publishable https", () => {
    expect(() =>
      parsePublicConfig({
        VITE_SUPABASE_URL: "http://example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toThrow();
    expect(
      parsePublicConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).not.toBeNull();
  });
});
