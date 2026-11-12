import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "./api";

export function TaskStats({ tasks }: { tasks: Task[] }) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const stats = [
    { label: "Tổng số", value: tasks.length },
    { label: "Chưa hoàn thành", value: tasks.length - completed },
    { label: "Đã hoàn thành", value: completed },
  ];

  return (
    <section aria-label="Thống kê công việc" className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value }) => (
        <Card key={label} size="sm">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}
