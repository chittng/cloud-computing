import type { User } from "./api";

export interface Session {
  accessToken: string;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number;
  user: User;
}

const STORAGE_KEY = "task-manager.session";

/** "Remember me" keeps the session in localStorage; otherwise it ends with the browser tab. */
export function saveSession(session: Session, remember: boolean): void {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Partial<Session>;
    if (typeof session.accessToken === "string" && typeof session.expiresAt === "number") {
      return session as Session;
    }
  } catch {
    // Fall through and discard the corrupt value.
  }
  clearSession();
  return null;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
