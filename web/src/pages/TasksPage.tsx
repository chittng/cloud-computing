import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ApiClientError,
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  type TaskFilter,
  type TaskItem,
  type TaskStatus,
} from "../api/client";
import { formatDurationLabel, type StoredSession } from "../auth/session";

interface TasksPageProps {
  session: StoredSession;
  initialTasks: TaskItem[] | null;
  onLogout: () => void;
  onSessionExpired: () => void;
}

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface TaskStats {
  total: number;
  pending: number;
  completed: number;
}

const MAX_TITLE_LENGTH = 255;

function getTodayDateString(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDateDisplay(dueDate: string): string {
  const [year, month, day] = dueDate.split("-");
  if (!year || !month || !day) return dueDate;
  return `${day}/${month}/${year}`;
}

function sortTasksByDueDate(items: readonly TaskItem[]): TaskItem[] {
  return [...items].sort((a, b) => {
    if (a.due_date === null && b.due_date !== null) return 1;
    if (a.due_date !== null && b.due_date === null) return -1;
    if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    return a.id - b.id;
  });
}

function computeTaskStats(items: readonly TaskItem[]): TaskStats {
  const completed = items.filter((item) => item.status === "completed").length;
  return {
    total: items.length,
    pending: items.length - completed,
    completed,
  };
}

function taskMatchesFilter(task: TaskItem, filter: TaskFilter): boolean {
  return filter === "all" || task.status === filter;
}

function adjustStatsForCreate(prev: TaskStats, status: TaskStatus): TaskStats {
  return {
    total: prev.total + 1,
    pending: prev.pending + (status === "pending" ? 1 : 0),
    completed: prev.completed + (status === "completed" ? 1 : 0),
  };
}

function adjustStatsForStatusChange(
  prev: TaskStats,
  oldStatus: TaskStatus,
  newStatus: TaskStatus,
): TaskStats {
  if (oldStatus === newStatus) return prev;
  if (newStatus === "completed") {
    return {
      total: prev.total,
      pending: Math.max(0, prev.pending - 1),
      completed: prev.completed + 1,
    };
  }
  return {
    total: prev.total,
    pending: prev.pending + 1,
    completed: Math.max(0, prev.completed - 1),
  };
}

function adjustStatsForDelete(prev: TaskStats, deletedStatus: TaskStatus): TaskStats {
  return {
    total: Math.max(0, prev.total - 1),
    pending: deletedStatus === "pending" ? Math.max(0, prev.pending - 1) : prev.pending,
    completed: deletedStatus === "completed" ? Math.max(0, prev.completed - 1) : prev.completed,
  };
}

export function TasksPage({ session, initialTasks, onLogout, onSessionExpired }: TasksPageProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    initialTasks ? sortTasksByDueDate(initialTasks) : [],
  );
  const [stats, setStats] = useState<TaskStats>(() =>
    initialTasks ? computeTaskStats(initialTasks) : { total: 0, pending: 0, completed: 0 },
  );
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [isLoading, setIsLoading] = useState(initialTasks === null);
  const [isCreating, setIsCreating] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("pending");
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const skippedInitialFetchRef = useRef(initialTasks !== null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        showToast("error", err.message);
        return;
      }
      showToast("error", fallbackMessage);
    },
    [onSessionExpired, showToast],
  );

  const loadTasks = useCallback(
    async (activeFilter: TaskFilter) => {
      setIsLoading(true);
      try {
        const statusParam = activeFilter === "all" ? undefined : activeFilter;
        const response = await fetchTasks(session.access_token, statusParam);
        const sorted = sortTasksByDueDate(response.items);
        setTasks(sorted);
        if (activeFilter === "all") {
          setStats(computeTaskStats(sorted));
        }
      } catch (err) {
        handleApiError(err, "Không thể tải danh sách công việc!");
      } finally {
        setIsLoading(false);
      }
    },
    [handleApiError, session.access_token],
  );

  useEffect(() => {
    if (skippedInitialFetchRef.current && filter === "all") {
      skippedInitialFetchRef.current = false;
      return;
    }
    void loadTasks(filter);
  }, [filter, loadTasks]);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      showToast("error", "Vui lòng nhập tiêu đề công việc!");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      showToast("error", "Tiêu đề công việc tối đa 255 ký tự!");
      return;
    }

    const normalizedDescription = newDescription.trim().length > 0 ? newDescription : null;
    const normalizedDueDate = newDueDate.trim().length > 0 ? newDueDate : null;

    setIsCreating(true);
    try {
      const created = await createTask(session.access_token, {
        title: trimmedTitle,
        description: normalizedDescription,
        due_date: normalizedDueDate,
      });

      setStats((prev) => adjustStatsForCreate(prev, created.status));
      if (taskMatchesFilter(created, filter)) {
        setTasks((prev) => sortTasksByDueDate([...prev, created]));
      }
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      showToast("success", "Đã thêm công việc mới");
    } catch (err) {
      handleApiError(err, "Không thể thêm công việc. Vui lòng thử lại!");
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(task: TaskItem) {
    setConfirmDeleteId(null);
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditDueDate(task.due_date ?? "");
    setEditStatus(task.status);
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDescription("");
    setEditDueDate("");
    setEditStatus("pending");
  }

  async function handleSaveEdit(task: TaskItem) {
    if (busyTaskId === task.id) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      showToast("error", "Tiêu đề công việc không được để trống!");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      showToast("error", "Tiêu đề công việc tối đa 255 ký tự!");
      return;
    }

    const nextDescription = editDescription.trim().length > 0 ? editDescription : null;
    const nextDueDate = editDueDate.trim().length > 0 ? editDueDate : null;

    setBusyTaskId(task.id);
    try {
      const updated = await updateTask(session.access_token, task.id, {
        title: trimmedTitle,
        description: nextDescription,
        due_date: nextDueDate,
        status: editStatus,
      });

      setStats((prev) => adjustStatsForStatusChange(prev, task.status, updated.status));
      setTasks((prev) => {
        const nextList = taskMatchesFilter(updated, filter)
          ? prev.map((item) => (item.id === updated.id ? updated : item))
          : prev.filter((item) => item.id !== updated.id);
        return sortTasksByDueDate(nextList);
      });
      cancelEditing();
      showToast("success", "Đã cập nhật công việc");
    } catch (err) {
      handleApiError(err, "Không thể cập nhật công việc!");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleToggleStatus(task: TaskItem) {
    if (busyTaskId === task.id) return;

    const nextStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    setBusyTaskId(task.id);
    try {
      const updated = await updateTask(session.access_token, task.id, { status: nextStatus });

      setStats((prev) => adjustStatsForStatusChange(prev, task.status, updated.status));
      setTasks((prev) => {
        const nextList = taskMatchesFilter(updated, filter)
          ? prev.map((item) => (item.id === updated.id ? updated : item))
          : prev.filter((item) => item.id !== updated.id);
        return sortTasksByDueDate(nextList);
      });
      showToast(
        "success",
        nextStatus === "completed" ? "Đã đánh dấu hoàn thành" : "Đã chuyển về chưa hoàn thành",
      );
    } catch (err) {
      handleApiError(err, "Không thể đổi trạng thái công việc!");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleConfirmDelete(task: TaskItem) {
    if (busyTaskId === task.id) return;

    setBusyTaskId(task.id);
    try {
      await deleteTask(session.access_token, task.id);
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      setStats((prev) => adjustStatsForDelete(prev, task.status));
      setConfirmDeleteId(null);
      if (editingTaskId === task.id) {
        cancelEditing();
      }
      showToast("success", "Đã xóa công việc");
    } catch (err) {
      handleApiError(err, "Không thể xóa công việc!");
    } finally {
      setBusyTaskId(null);
    }
  }

  const displayName = session.user.display_name || session.user.email;
  const todayStr = useMemo(() => getTodayDateString(), []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm shadow-indigo-200">
              ✓
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">Task Manager</h1>
              <p className="text-xs text-slate-500">
                Xin chào, <span className="font-semibold text-slate-700">{displayName}</span>
                {session.user.display_name ? ` (${session.user.email})` : ""} · Phiên{" "}
                {formatDurationLabel(session.expires_in)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {toast && (
          <div
            role={toast.type === "error" ? "alert" : "status"}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xs ${
              toast.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setToast(null)}
              className="cursor-pointer rounded-lg px-2 py-0.5 text-base font-bold opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        <section aria-label="Thống kê công việc" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tổng công việc
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Chưa hoàn thành
            </p>
            <p className="mt-1 text-2xl font-extrabold text-amber-800">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Đã hoàn thành
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-800">{stats.completed}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="mb-4 text-base font-bold text-slate-800">Thêm công việc mới</h2>
          <form onSubmit={handleCreateSubmit} noValidate className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-task-title"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Tiêu đề công việc
                </label>
                <input
                  id="new-task-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Hoàn thành báo cáo CLOUD-11"
                  disabled={isCreating}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="new-task-due-date"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Hạn hoàn thành
                </label>
                <input
                  id="new-task-due-date"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  disabled={isCreating}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-task-description"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Mô tả chi tiết <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <textarea
                id="new-task-description"
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ghi chú nội dung hoặc các bước thực hiện..."
                disabled={isCreating}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Đang thêm..." : "+ Thêm công việc"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "pending", label: "Chưa hoàn thành" },
                  { id: "completed", label: "Đã hoàn thành" },
                ] as const
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(tab.id)}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-medium text-slate-500">
              Hiển thị {tasks.length} công việc (sắp xếp theo hạn hoàn thành)
            </p>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Đang tải danh sách công việc...
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">
                {filter === "all"
                  ? "Chưa có công việc nào."
                  : filter === "pending"
                    ? "Không có công việc chưa hoàn thành."
                    : "Chưa có công việc nào đã hoàn thành."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {filter === "all"
                  ? "Hãy thêm công việc đầu tiên ở biểu mẫu phía trên."
                  : "Thử chuyển bộ lọc sang Tất cả để xem các công việc khác."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                const isBusy = busyTaskId === task.id;
                const isConfirmingDelete = confirmDeleteId === task.id;
                const isCompleted = task.status === "completed";
                const isOverdue =
                  !isCompleted && task.due_date !== null && task.due_date < todayStr;

                return (
                  <li
                    key={task.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`edit-title-${task.id}`}
                              className="mb-1 block text-xs font-semibold text-slate-600"
                            >
                              Chỉnh sửa tiêu đề
                            </label>
                            <input
                              id={`edit-title-${task.id}`}
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              disabled={isBusy}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`edit-status-${task.id}`}
                              className="mb-1 block text-xs font-semibold text-slate-600"
                            >
                              Trạng thái
                            </label>
                            <select
                              id={`edit-status-${task.id}`}
                              value={editStatus}
                              onChange={(e) =>
                                setEditStatus(
                                  e.target.value === "completed" ? "completed" : "pending",
                                )
                              }
                              disabled={isBusy}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-600"
                            >
                              <option value="pending">Chưa hoàn thành</option>
                              <option value="completed">Đã hoàn thành</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`edit-desc-${task.id}`}
                              className="mb-1 block text-xs font-semibold text-slate-600"
                            >
                              Chỉnh sửa mô tả
                            </label>
                            <textarea
                              id={`edit-desc-${task.id}`}
                              rows={2}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              disabled={isBusy}
                              placeholder="Để trống nếu muốn xóa mô tả"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`edit-due-date-${task.id}`}
                              className="mb-1 block text-xs font-semibold text-slate-600"
                            >
                              Chỉnh sửa hạn hoàn thành
                            </label>
                            <input
                              id={`edit-due-date-${task.id}`}
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              disabled={isBusy}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isBusy}
                            className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSaveEdit(task);
                            }}
                            disabled={isBusy}
                            className="cursor-pointer rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {isBusy ? "Đang lưu..." : "Lưu thay đổi"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            disabled={isBusy}
                            aria-label={`Đánh dấu "${task.title}" ${
                              isCompleted ? "chưa hoàn thành" : "đã hoàn thành"
                            }`}
                            onChange={() => {
                              void handleToggleStatus(task);
                            }}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600"
                          />

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-sm font-bold ${
                                  isCompleted ? "text-slate-400 line-through" : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  isCompleted
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isCompleted ? "Đã hoàn thành" : "Chưa hoàn thành"}
                              </span>

                              {task.due_date && (
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    isOverdue
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  Hạn: {formatDueDateDisplay(task.due_date)}
                                  {isOverdue ? " (Quá hạn)" : ""}
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p
                                className={`whitespace-pre-wrap text-sm ${
                                  isCompleted ? "text-slate-400" : "text-slate-600"
                                }`}
                              >
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                          {isConfirmingDelete ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  void handleConfirmDelete(task);
                                }}
                                className="cursor-pointer rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                              >
                                {isBusy ? "Đang xóa..." : "Xác nhận xóa"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => startEditing(task)}
                                aria-label={`Sửa "${task.title}"`}
                                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(task.id)}
                                aria-label={`Xóa "${task.title}"`}
                                className="cursor-pointer rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
