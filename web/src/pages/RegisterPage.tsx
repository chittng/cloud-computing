import { useState, type FormEvent } from "react";
import { ApiClientError, registerAccount } from "../api/client";

interface RegisterPageProps {
  onNavigateToLogin: (prefilledEmail?: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage({ onNavigateToLogin }: RegisterPageProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMessage("Vui lòng nhập đầy đủ email, mật khẩu và xác nhận mật khẩu!");
      return;
    }

    if (trimmedEmail.length > 255 || !EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage("Định dạng email không hợp lệ hoặc vượt quá 255 ký tự!");
      return;
    }

    if (trimmedName.length > 100) {
      setErrorMessage("Tên hiển thị tối đa 100 ký tự!");
      return;
    }

    const passwordBytes = new TextEncoder().encode(password).length;
    if (password.trim().length === 0 || passwordBytes < 8 || passwordBytes > 72) {
      setErrorMessage("Mật khẩu phải từ 8 đến 72 byte UTF-8 và không chỉ chứa khoảng trắng!");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp. Vui lòng nhập lại!");
      return;
    }

    setLoading(true);
    try {
      await registerAccount({
        email: trimmedEmail,
        password,
        display_name: trimmedName.length > 0 ? trimmedName : null,
      });

      setSuccessMessage("Tạo tài khoản thành công! Đang chuyển hướng sang đăng nhập...");
      setLoading(false);
      window.setTimeout(() => {
        onNavigateToLogin(trimmedEmail);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại sau!");
      }
      setLoading(false);
    }
  }

  const formLocked = loading || Boolean(successMessage);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-md shadow-indigo-200">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">Đăng ký tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo tài khoản để bắt đầu quản lý công việc của bạn
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <div>
              <p className="font-semibold">Đăng ký thất bại</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <div>
              <p className="font-semibold">Thành công</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="register-display-name"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Tên hiển thị <span className="text-xs font-normal text-slate-400">(tùy chọn)</span>
            </label>
            <input
              id="register-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nguyễn Văn A"
              disabled={formLocked}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Địa chỉ Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={formLocked}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Mật khẩu <span className="text-xs font-normal text-slate-500">(8–72 byte UTF-8)</span>
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập ít nhất 8 ký tự"
              disabled={formLocked}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Xác nhận mật khẩu
            </label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu vừa nhập"
              disabled={formLocked}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={formLocked}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-sm text-slate-600">
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() => onNavigateToLogin()}
              disabled={loading}
              className="cursor-pointer font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline disabled:opacity-50"
            >
              Đăng nhập ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
