import { useEffect, useState } from "react";
import type { ThemeMode } from "../domain/models";
function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem("gamehive-theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}
export function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "gamehive-theme" || event.key === null)
        setMode(readMode());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme =
        mode === "system" ? (preference?.matches ? "light" : "dark") : mode;
    };
    apply();
    preference?.addEventListener("change", apply);
    try {
      localStorage.setItem("gamehive-theme", mode);
    } catch {
      /* El tema sigue operativo sin almacenamiento. */
    }
    return () => preference?.removeEventListener("change", apply);
  }, [mode]);
  return (
    <label className="theme-control">
      Tema
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as ThemeMode)}
      >
        <option value="system">Sistema</option>
        <option value="dark">Oscuro</option>
        <option value="light">Claro</option>
      </select>
    </label>
  );
}
