// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY } from "./session";
import { Root } from "../Root";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";

function buildFakeJwt(expEpochSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payload = btoa(
    JSON.stringify({ sub: "7", email: "trang@example.com", exp: expEpochSeconds }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${payload}.signature`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CLOUD-10 Auth UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates register inputs, surfaces API 409 error, and redirects to login after creation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "EMAIL_ALREADY_EXISTS",
              message: "Email is already registered",
            },
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 7,
            email: "trang@example.com",
            display_name: "Huyền Trang",
            created_at: "2026-11-11T10:00:00.000Z",
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onNavigateToLogin = vi.fn();
    render(<RegisterPage onNavigateToLogin={onNavigateToLogin} />);

    fireEvent.change(screen.getByLabelText(/Tên hiển thị/i), {
      target: { value: "Huyền Trang" },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Định dạng email không hợp lệ");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), {
      target: { value: "TRANG@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: "Mismatch123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mật khẩu xác nhận không khớp");

    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email is already registered");

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toHaveTextContent("Tạo tài khoản thành công");

    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(onNavigateToLogin).toHaveBeenCalledWith("trang@example.com");
  });

  it("shows loading disabled state on login submit and stores session per remember checkbox", async () => {
    let resolveLogin!: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveLogin = resolve;
    });

    const expSeconds = Math.floor(Date.now() / 1000) + 3600;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(pendingPromise)
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: buildFakeJwt(expSeconds),
          token_type: "Bearer",
          expires_in: 3600,
          user: { id: 7, email: "trang@example.com", display_name: null },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} onNavigateToRegister={vi.fn()} />);

    const emailInput = screen.getByLabelText(/Địa chỉ Email/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu/i);
    const rememberCheckbox = screen.getByLabelText(/Ghi nhớ đăng nhập/i);

    fireEvent.change(emailInput, { target: { value: "trang@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });
    expect(rememberCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    const loadingButton = screen.getByRole("button", { name: "Đang đăng nhập..." });
    expect(loadingButton).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    resolveLogin(
      jsonResponse({
        access_token: buildFakeJwt(expSeconds),
        token_type: "Bearer",
        expires_in: 3600,
        user: { id: 7, email: "trang@example.com", display_name: "Trang" },
      }),
    );

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();

    cleanup();
    const onSessionOnlySuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onSessionOnlySuccess} onNavigateToRegister={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), {
      target: { value: "trang@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByLabelText(/Ghi nhớ đăng nhập/i));
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(onSessionOnlySuccess).toHaveBeenCalledTimes(1);
    });
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("redirects expired stored session and 401 session errors back to Login", async () => {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        access_token: buildFakeJwt(Math.floor(Date.now() / 1000) - 10),
        expires_in: 3600,
        expires_at: Date.now() - 10_000,
        remember: true,
        user: { id: 7, email: "expired@example.com", display_name: null },
      }),
    );

    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<Root />);
    expect(await screen.findByText(/Phiên hoạt động đã hết hạn/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    cleanup();
    window.sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        access_token: buildFakeJwt(Math.floor(Date.now() / 1000) + 3600),
        expires_in: 3600,
        expires_at: Date.now() + 3_600_000,
        remember: false,
        user: { id: 7, email: "revoked@example.com", display_name: null },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }, 401),
    );

    render(<Root />);
    expect(await screen.findByText(/Phiên hoạt động đã hết hạn/i)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("automatically redirects to Login when session expires while active", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    window.sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        access_token: buildFakeJwt(Math.floor((now + 2000) / 1000)),
        expires_in: 2,
        expires_at: now + 2000,
        remember: false,
        user: { id: 7, email: "active@example.com", display_name: "Trang" },
      }),
    );

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], count: 0 }, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<Root />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByRole("heading", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(screen.getByText(/Phiên hoạt động đã hết hạn/i)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
