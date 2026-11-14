import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getAuthService, type AuthService } from "../../services/auth";
import { publicError } from "../../services/errors";

interface AuthState {
  service: AuthService | null;
  session: Session | null;
  loading: boolean;
  error: string;
  retry: () => void;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => {
    try {
      return { value: getAuthService(), error: "" };
    } catch (e) {
      return { value: null, error: publicError(e) };
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!service.value);
  const [error, setError] = useState(service.error);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!service.value) return;
    let active = true;
    let observed = false;
    const unsubscribe = service.value.subscribe((next) => {
      observed = true;
      if (active) {
        setSession(next);
        setLoading(false);
        setError("");
      }
    });
    service.value
      .session()
      .then((next) => {
        if (active && !observed) {
          setSession(next);
          setLoading(false);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(publicError(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service, attempt]);
  return (
    <Context.Provider
      value={{
        service: service.value,
        session,
        loading,
        error,
        retry: () => setAttempt((n) => n + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const state = useContext(Context);
  if (!state) throw new Error("AuthProvider required");
  return state;
}
