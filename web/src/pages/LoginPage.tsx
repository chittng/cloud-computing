import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError, loginAccount } from "../api/client";
import { saveSession, type StoredSession } from "../auth/session";

interface LoginPageProps {
  onLoginSuccess: (session: StoredSession) => void;
  onNavigateToRegister: () => void;
  sessionNotice?: string;
  initialEmail?: string;
}

export function LoginPage({
  onLoginSuccess,
  onNavigateToRegister,
  sessionNotice,
  initialEmail = "",
}: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || password.trim().length === 0) {
      setErrorMessage("Vui lòng nhập đầy đủ email và mật khẩu!");
      return;
    }

    setLoading(true);
    try {
      const response = await loginAccount({ email: trimmedEmail, password });
      const session = saveSession(response, remember);
      onLoginSuccess(session);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại sau!");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-md shadow-indigo-200">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">Đăng nhập hệ thống</h1>
          <p className="mt-1 text-sm text-slate-500">Chào mừng bạn quay trở lại với Task Manager</p>
        </div>

        {sessionNotice && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          >
            <div>
              <p className="font-semibold">Thông báo phiên làm việc</p>
              <p className="mt-0.5">{sessionNotice}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <div>
              <p className="font-semibold">Đăng nhập thất bại</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Địa chỉ Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ví dụ: user@example.com"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Mật khẩu
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <label
              htmlFor="remember"
              className="flex cursor-pointer select-none items-center gap-2"
            >
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Ghi nhớ đăng nhập</span>
            </label>
            <span className="text-right text-xs text-slate-400">
              {remember ? "Giữ phiên theo thời hạn máy chủ" : "Hết phiên khi đóng trình duyệt"}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-sm text-slate-600">
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={onNavigateToRegister}
              disabled={loading}
              className="cursor-pointer font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline disabled:opacity-50"
            >
              Đăng ký tài khoản ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
