import type { LoginApiResponse, UserProfile } from "../api/client";

export const AUTH_STORAGE_KEY = "cloud_task_manager_auth_session";

export interface StoredSession {
  access_token: string;
  expires_in: number;
  expires_at: number;
  remember: boolean;
  user: UserProfile;
}

export type SessionLoadResult =
  | { status: "none" }
  | { status: "expired" }
  | { status: "active"; session: StoredSession };

function parseJwtExpMs(token: string): number | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveSession(
  login: LoginApiResponse,
  remember: boolean,
  nowMs: number = Date.now(),
): StoredSession {
  const jwtExpMs = parseJwtExpMs(login.access_token);
  const expiresAt = jwtExpMs ?? nowMs + login.expires_in * 1000;
  const session: StoredSession = {
    access_token: login.access_token,
    expires_in: login.expires_in,
    expires_at: expiresAt,
    remember,
    user: login.user,
  };

  const serialized = JSON.stringify(session);
  if (remember) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return session;
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function readRawSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.access_token !== "string" ||
      typeof parsed.expires_at !== "number" ||
      typeof parsed.expires_in !== "number" ||
      !parsed.user ||
      typeof parsed.user.id !== "number" ||
      typeof parsed.user.email !== "string"
    ) {
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function loadStoredSession(nowMs: number = Date.now()): SessionLoadResult {
  const fromSession = readRawSession(window.sessionStorage.getItem(AUTH_STORAGE_KEY));
  const fromLocal = readRawSession(window.localStorage.getItem(AUTH_STORAGE_KEY));
  const session = fromSession ?? fromLocal;

  if (!session) {
    clearStoredSession();
    return { status: "none" };
  }

  if (session.expires_at <= nowMs) {
    clearStoredSession();
    return { status: "expired" };
  }

  return { status: "active", session };
}

export function formatDurationLabel(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${seconds / 3600} giờ`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)} phút`;
  }
  return `${seconds} giây`;
}
