import { useCallback, useEffect, useState } from "react";
import { ApiClientError, fetchTasks, type TaskItem } from "./api/client";
import {
  clearStoredSession,
  formatDurationLabel,
  loadStoredSession,
  type StoredSession,
} from "./auth/session";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

const MAX_TIMEOUT_MS = 2_147_483_647;

function updateUrlPageParam(page?: "login" | "register"): void {
  const url = new URL(window.location.href);
  if (page) {
    url.searchParams.set("page", page);
    window.history.replaceState({}, "", url.toString());
  } else {
    url.searchParams.delete("page");
    window.history.replaceState({}, "", url.pathname);
  }
}

export function Root() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [initialTasks, setInitialTasks] = useState<TaskItem[] | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState<"login" | "register">(() => {
    const pageParam = new URLSearchParams(window.location.search).get("page");
    return pageParam === "register" ? "register" : "login";
  });
  const [sessionNotice, setSessionNotice] = useState("");
  const [prefilledEmail, setPrefilledEmail] = useState("");

  const handleSessionExpired = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setInitialTasks(null);
    setSessionNotice("Phiên hoạt động đã hết hạn. Vui lòng đăng nhập lại!");
    setCurrentPage("login");
    updateUrlPageParam("login");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verifyStoredSession() {
      const loaded = loadStoredSession();
      if (loaded.status === "none") {
        if (!cancelled) setIsCheckingAuth(false);
        return;
      }
      if (loaded.status === "expired") {
        if (!cancelled) {
          setSessionNotice("Phiên hoạt động đã hết hạn. Vui lòng đăng nhập lại!");
          setCurrentPage("login");
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        const list = await fetchTasks(loaded.session.access_token);
        if (!cancelled) {
          setSession(loaded.session);
          setInitialTasks(list.items);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiClientError && err.status === 401) {
            clearStoredSession();
            setSessionNotice("Phiên hoạt động đã hết hạn. Vui lòng đăng nhập lại!");
            setCurrentPage("login");
          } else {
            setSession(loaded.session);
          }
        }
      } finally {
        if (!cancelled) setIsCheckingAuth(false);
      }
    }

    void verifyStoredSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    const remainingMs = session.expires_at - Date.now();
    if (remainingMs <= 0) {
      handleSessionExpired();
      return undefined;
    }

    const delay = Math.min(remainingMs, MAX_TIMEOUT_MS);
    const timer = window.setTimeout(() => {
      if (Date.now() >= session.expires_at) {
        handleSessionExpired();
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session, handleSessionExpired]);

  function handleLoginSuccess(nextSession: StoredSession) {
    setSession(nextSession);
    setInitialTasks(null);
    setSessionNotice("");
    updateUrlPageParam();
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setInitialTasks(null);
    setSessionNotice("");
    setCurrentPage("login");
    updateUrlPageParam("login");
  }

  function navigateToRegister() {
    setSessionNotice("");
    setCurrentPage("register");
    updateUrlPageParam("register");
  }

  function navigateToLogin(email?: string) {
    if (email) {
      setPrefilledEmail(email);
    }
    setCurrentPage("login");
    updateUrlPageParam("login");
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-200">
            ✓
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Đang kiểm tra phiên đăng nhập...
          </p>
        </div>
      </div>
    );
  }

  if (session) {
    const displayName = session.user.display_name || session.user.email;
    void initialTasks;
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-slate-800">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Xin chào, {displayName}</h1>
              <p className="text-sm text-slate-500">
                Phiên đăng nhập ({formatDurationLabel(session.expires_in)}){" "}
                {session.remember
                  ? "— đã bật Ghi nhớ đăng nhập"
                  : "— chỉ giữ trong phiên trình duyệt"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === "register") {
    return <RegisterPage onNavigateToLogin={navigateToLogin} />;
  }

  return (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      onNavigateToRegister={navigateToRegister}
      sessionNotice={sessionNotice}
      initialEmail={prefilledEmail}
    />
  );
}
