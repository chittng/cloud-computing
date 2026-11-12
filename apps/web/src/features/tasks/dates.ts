import type { Task } from "./api";

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Today's date in the user's time zone, as "YYYY-MM-DD". */
export function today(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Formats a "YYYY-MM-DD" date as dd/mm/yyyy without shifting it across time zones. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return dateFormat.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function isOverdue(task: Task, now = new Date()): boolean {
  return task.status === "pending" && task.dueDate !== null && task.dueDate < today(now);
}
