import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app/app";
import { alice, installFakeApi, makeTask, requestsTo, signInAs } from "@/test/fake-api";

function renderTasksPage() {
  window.history.replaceState(null, "", "/");
  render(<App />);
  return userEvent.setup();
}

describe("tasks page", () => {
  beforeEach(() => signInAs(alice));

  it("shows the tasks with their counts", async () => {
    installFakeApi([
      makeTask({ id: 1, title: "Viết báo cáo", dueDate: "2000-01-01" }),
      makeTask({ id: 2, title: "Nộp bài", status: "completed" }),
    ]);
    renderTasksPage();

    const report = (await screen.findByText("Viết báo cáo")).closest("li")!;
    expect(within(report).getByText(/Quá hạn/)).toBeInTheDocument();

    const stats = within(screen.getByRole("region", { name: "Thống kê công việc" }));
    expect(stats.getByText("Tổng số").nextSibling).toHaveTextContent("2");
    expect(stats.getByText("Chưa hoàn thành").nextSibling).toHaveTextContent("1");
    expect(stats.getByText("Đã hoàn thành").nextSibling).toHaveTextContent("1");
  });

  it("shows an empty state when there are no tasks", async () => {
    installFakeApi();
    renderTasksPage();

    expect(await screen.findByText("Không có công việc nào")).toBeInTheDocument();
  });

  it("creates a task and clears the form", async () => {
    const { fetchMock } = installFakeApi();
    const user = renderTasksPage();
    await screen.findByText("Không có công việc nào");

    await user.type(screen.getByLabelText("Tiêu đề"), "  Ôn thi  ");
    await user.click(screen.getByRole("button", { name: "Thêm công việc" }));

    expect(await screen.findByRole("heading", { name: "Ôn thi" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tiêu đề")).toHaveValue("");
    expect(requestsTo(fetchMock, "/api/tasks", "POST")).toEqual([
      { title: "Ôn thi", description: null, dueDate: null },
    ]);
  });

  it("requires a title", async () => {
    const { fetchMock } = installFakeApi();
    const user = renderTasksPage();
    await screen.findByText("Không có công việc nào");

    await user.click(screen.getByRole("button", { name: "Thêm công việc" }));

    expect(await screen.findByText("Vui lòng nhập tiêu đề")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "/api/tasks", "POST")).toEqual([]);
  });

  it("marks a task as completed", async () => {
    const { fetchMock } = installFakeApi([makeTask({ id: 1, title: "Viết báo cáo" })]);
    const user = renderTasksPage();

    await user.click(
      await screen.findByRole("checkbox", { name: 'Đánh dấu "Viết báo cáo" là đã hoàn thành' }),
    );

    expect(
      await screen.findByRole("checkbox", { name: 'Đánh dấu "Viết báo cáo" là chưa hoàn thành' }),
    ).toBeChecked();
    expect(requestsTo(fetchMock, "/api/tasks/1", "PATCH")).toEqual([{ status: "completed" }]);
  });

  it("edits a task in a dialog", async () => {
    const { fetchMock } = installFakeApi([
      makeTask({ id: 1, title: "Viết báo cáo", description: "Bản nháp" }),
    ]);
    const user = renderTasksPage();

    await user.click(await screen.findByRole("button", { name: 'Sửa "Viết báo cáo"' }));
    const dialog = await screen.findByRole("dialog", { name: "Sửa công việc" });
    await user.clear(within(dialog).getByLabelText("Tiêu đề"));
    await user.type(within(dialog).getByLabelText("Tiêu đề"), "Viết báo cáo cuối kỳ");
    await user.clear(within(dialog).getByLabelText("Mô tả"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    expect(
      await screen.findByRole("heading", { name: "Viết báo cáo cuối kỳ" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(requestsTo(fetchMock, "/api/tasks/1", "PATCH")).toEqual([
      { title: "Viết báo cáo cuối kỳ", description: null, dueDate: null },
    ]);
  });

  it("deletes a task after confirmation", async () => {
    const { fetchMock } = installFakeApi([makeTask({ id: 1, title: "Viết báo cáo" })]);
    const user = renderTasksPage();

    await user.click(await screen.findByRole("button", { name: 'Xóa "Viết báo cáo"' }));
    await user.click(await screen.findByRole("button", { name: "Xóa" }));

    expect(await screen.findByText("Không có công việc nào")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "/api/tasks/1", "DELETE")).toHaveLength(1);
  });

  it("filters tasks by status", async () => {
    installFakeApi([
      makeTask({ id: 1, title: "Viết báo cáo" }),
      makeTask({ id: 2, title: "Nộp bài", status: "completed" }),
    ]);
    const user = renderTasksPage();
    await screen.findByText("Viết báo cáo");

    await user.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));

    expect(screen.getByText("Nộp bài")).toBeInTheDocument();
    expect(screen.queryByText("Viết báo cáo")).toBeNull();
  });
});
