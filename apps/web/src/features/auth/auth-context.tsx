import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LoginResponse } from "./api";
import { clearSession, loadSession, type Session, saveSession } from "./session";

/** setTimeout fires immediately for delays above this value. */
const MAX_TIMEOUT_MS = 2_147_483_647;

interface AuthState {
  session: Session | null;
  /** The previous session ended because its token expired or was rejected. */
  sessionExpired: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (response: LoginResponse, remember: boolean) => void;
  signOut: (reason?: "user" | "expired") => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function initialState(): AuthState {
  const session = loadSession();
  if (session && session.expiresAt <= Date.now()) {
    clearSession();
    return { session: null, sessionExpired: true };
  }
  return { session, sessionExpired: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);

  const signIn = useCallback((response: LoginResponse, remember: boolean) => {
    const session: Session = {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: response.user,
    };
    saveSession(session, remember);
    setState({ session, sessionExpired: false });
  }, []);

  const signOut = useCallback((reason: "user" | "expired" = "user") => {
    clearSession();
    setState({ session: null, sessionExpired: reason === "expired" });
  }, []);

  // End the session as soon as the token expires.
  useEffect(() => {
    if (!state.session) return;
    const delay = Math.min(Math.max(state.session.expiresAt - Date.now(), 0), MAX_TIMEOUT_MS);
    const timer = window.setTimeout(() => signOut("expired"), delay);
    return () => window.clearTimeout(timer);
  }, [state.session, signOut]);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

/** For components rendered behind RequireAuth. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error("useSession requires a signed-in user");
  return session;
}
