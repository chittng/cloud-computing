// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "../api/client";
import { AUTH_STORAGE_KEY, type StoredSession } from "../auth/session";
import { Root } from "../Root";
import { TasksPage } from "./TasksPage";

function buildSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    access_token: "test-jwt-token",
    expires_in: 3600,
    expires_at: Date.now() + 3_600_000,
    remember: true,
    user: {
      id: 7,
      email: "trang@example.com",
      display_name: "Huyền Trang",
    },
    ...overrides,
  };
}

function makeTask(partial: Partial<TaskItem> & { id: number; title: string }): TaskItem {
  return {
    description: null,
    due_date: null,
    status: "pending",
    created_at: "2026-11-11T09:00:00.000Z",
    updated_at: "2026-11-11T09:00:00.000Z",
    ...partial,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CLOUD-11 Task Manager UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads tasks sorted by due_date and creates a new task with success toast", async () => {
    const initialList: TaskItem[] = [
      makeTask({ id: 2, title: "Không có hạn", due_date: null }),
      makeTask({ id: 1, title: "Hạn ngày 20", due_date: "2099-11-20" }),
    ];
    const createdTask = makeTask({
      id: 3,
      title: "Nộp báo cáo CLOUD-11",
      description: "Kiểm tra MySQL và UI",
      due_date: "2099-11-15",
      status: "pending",
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: initialList, count: 2 }))
      .mockResolvedValueOnce(jsonResponse(createdTask, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TasksPage
        session={buildSession()}
        initialTasks={null}
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    const headingsBefore = await screen.findAllByRole("heading", { level: 3 });
    expect(headingsBefore.map((h) => h.textContent)).toEqual(["Hạn ngày 20", "Không có hạn"]);

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm công việc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng nhập tiêu đề công việc!");

    fireEvent.change(screen.getByLabelText(/Tiêu đề công việc/i), {
      target: { value: "  Nộp báo cáo CLOUD-11  " },
    });
    fireEvent.change(screen.getByLabelText(/Hạn hoàn thành/i), {
      target: { value: "2099-11-15" },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: "Kiểm tra MySQL và UI" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm công việc" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã thêm công việc mới");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Nộp báo cáo CLOUD-11",
          description: "Kiểm tra MySQL và UI",
          due_date: "2099-11-15",
        }),
      }),
    );

    const headingsAfter = screen.getAllByRole("heading", { level: 3 });
    expect(headingsAfter.map((h) => h.textContent)).toEqual([
      "Nộp báo cáo CLOUD-11",
      "Hạn ngày 20",
      "Không có hạn",
    ]);
  });

  it("supports inline edit, status toggle, and confirmed deletion", async () => {
    const initialTasks: TaskItem[] = [
      makeTask({
        id: 10,
        title: "Viết test API",
        description: "Ghi chú cũ",
        due_date: "2099-12-01",
        status: "pending",
      }),
      makeTask({
        id: 11,
        title: "Dọn nhánh git",
        due_date: null,
        status: "completed",
      }),
    ];

    const updatedEdited = makeTask({
      id: 10,
      title: "Viết test API & UI",
      description: null,
      due_date: "2099-12-02",
      status: "pending",
    });
    const updatedToggled = { ...updatedEdited, status: "completed" as const };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(updatedEdited))
      .mockResolvedValueOnce(jsonResponse(updatedToggled))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TasksPage
        session={buildSession()}
        initialTasks={initialTasks}
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: 'Sửa "Viết test API"' }));
    fireEvent.change(screen.getByLabelText("Chỉnh sửa tiêu đề"), {
      target: { value: "Viết test API & UI" },
    });
    fireEvent.change(screen.getByLabelText("Chỉnh sửa mô tả"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Chỉnh sửa hạn hoàn thành"), {
      target: { value: "2099-12-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã cập nhật công việc");
    expect(
      screen.getByRole("heading", { level: 3, name: "Viết test API & UI" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ghi chú cũ")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Đánh dấu "Viết test API & UI" đã hoàn thành'));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã đánh dấu hoàn thành");

    fireEvent.click(screen.getByRole("button", { name: 'Xóa "Dọn nhánh git"' }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã xóa công việc");
    await waitFor(() => {
      expect(screen.queryByText("Dọn nhánh git")).not.toBeInTheDocument();
    });
  });

  it("queries server when filtering by status and keeps filter state consistent", async () => {
    const allItems: TaskItem[] = [
      makeTask({ id: 1, title: "Chưa xong", status: "pending" }),
      makeTask({ id: 2, title: "Đã xong", status: "completed" }),
    ];

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [allItems[0]], count: 1 }))
      .mockResolvedValueOnce(jsonResponse({ items: [allItems[1]], count: 1 }))
      .mockResolvedValueOnce(jsonResponse({ items: allItems, count: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TasksPage
        session={buildSession()}
        initialTasks={allItems}
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    const filterGroup = screen.getByRole("group", { name: "Lọc theo trạng thái" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Chưa hoàn thành" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/tasks?status=pending",
        expect.objectContaining({ method: "GET" }),
      );
    });
    expect(screen.getByText("Chưa xong")).toBeInTheDocument();
    expect(screen.queryByText("Đã xong")).not.toBeInTheDocument();

    fireEvent.click(within(filterGroup).getByRole("button", { name: "Đã hoàn thành" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/tasks?status=completed",
        expect.objectContaining({ method: "GET" }),
      );
    });
    expect(screen.getByText("Đã xong")).toBeInTheDocument();
    expect(screen.queryByText("Chưa xong")).not.toBeInTheDocument();

    fireEvent.click(within(filterGroup).getByRole("button", { name: "Tất cả" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/v1/tasks",
        expect.objectContaining({ method: "GET" }),
      );
    });
    expect(screen.getByText("Chưa xong")).toBeInTheDocument();
    expect(screen.getByText("Đã xong")).toBeInTheDocument();
  });

  it("shows error toast on failure and redirects to Login when API returns 401", async () => {
    const stored = buildSession();
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], count: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Máy chủ tạm gián đoạn" } }, 500),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "UNAUTHORIZED", message: "Token expired" } }, 401),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<Root />);
    expect(await screen.findByRole("button", { name: "+ Thêm công việc" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tiêu đề công việc/i), {
      target: { value: "Thử lỗi 500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm công việc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Máy chủ tạm gián đoạn");

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm công việc" }));
    expect(await screen.findByRole("heading", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(screen.getByText(/Phiên hoạt động đã hết hạn/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
