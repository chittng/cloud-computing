import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "@/app/app";
import { alice, installFakeApi, makeTask, PASSWORD, requestsTo, signInAs } from "@/test/fake-api";

function renderAt(path: string) {
  window.history.replaceState(null, "", path);
  render(<App />);
  return userEvent.setup();
}

describe("login", () => {
  it("validates the form before calling the API", async () => {
    const { fetchMock } = installFakeApi();
    const user = renderAt("/login");

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Email không hợp lệ")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server error for wrong credentials", async () => {
    installFakeApi();
    const user = renderAt("/login");

    await user.type(screen.getByLabelText("Email"), alice.email);
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Email hoặc mật khẩu không chính xác")).toBeInTheDocument();
  });

  it("opens the task list after a successful login", async () => {
    installFakeApi([makeTask({ id: 1, title: "Viết báo cáo" })]);
    const user = renderAt("/login");

    await user.type(screen.getByLabelText("Email"), ` ${alice.email.toUpperCase()} `);
    await user.type(screen.getByLabelText("Mật khẩu"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Viết báo cáo")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(localStorage.getItem("task-manager.session")).toContain("valid-token");
  });

  it("keeps the session only for the tab when 'remember me' is off", async () => {
    installFakeApi();
    const user = renderAt("/login");

    await user.type(screen.getByLabelText("Email"), alice.email);
    await user.type(screen.getByLabelText("Mật khẩu"), PASSWORD);
    await user.click(screen.getByLabelText("Ghi nhớ đăng nhập"));
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Danh sách công việc")).toBeInTheDocument();
    expect(localStorage.getItem("task-manager.session")).toBeNull();
    expect(sessionStorage.getItem("task-manager.session")).toContain("valid-token");
  });
});

describe("registration", () => {
  it("checks that the passwords match", async () => {
    const { fetchMock } = installFakeApi();
    const user = renderAt("/register");

    await user.type(screen.getByLabelText("Email"), "bob@example.test");
    await user.type(screen.getByLabelText("Mật khẩu"), PASSWORD);
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "different-password");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByText("Mật khẩu xác nhận không khớp")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the user to the login page with their email filled in", async () => {
    const { fetchMock } = installFakeApi();
    const user = renderAt("/register");

    await user.type(screen.getByLabelText("Tên hiển thị"), " Bob ");
    await user.type(screen.getByLabelText("Email"), "bob@example.test");
    await user.type(screen.getByLabelText("Mật khẩu"), PASSWORD);
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByText("Tạo tài khoản thành công. Hãy đăng nhập.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("bob@example.test");
    expect(requestsTo(fetchMock, "/api/auth/register", "POST")).toEqual([
      { email: "bob@example.test", password: PASSWORD, displayName: "Bob" },
    ]);
  });

  it("shows a duplicate email error from the server", async () => {
    installFakeApi();
    const user = renderAt("/register");

    await user.type(screen.getByLabelText("Email"), alice.email);
    await user.type(screen.getByLabelText("Mật khẩu"), PASSWORD);
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByText("Email đã được đăng ký")).toBeInTheDocument();
  });
});

describe("session", () => {
  it("redirects guests from the task list to the login page", async () => {
    installFakeApi();
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("signs out with a notice when the API rejects the token", async () => {
    installFakeApi();
    signInAs(alice, "revoked-token");
    renderAt("/");

    expect(
      await screen.findByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."),
    ).toBeInTheDocument();
    expect(localStorage.getItem("task-manager.session")).toBeNull();
  });

  it("signs out from the account menu", async () => {
    installFakeApi();
    signInAs(alice);
    const user = renderAt("/");

    await user.click(await screen.findByRole("button", { name: "Tài khoản" }));
    await user.click(await screen.findByRole("menuitem", { name: "Đăng xuất" }));

    expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(screen.queryByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")).toBeNull();
  });
});
