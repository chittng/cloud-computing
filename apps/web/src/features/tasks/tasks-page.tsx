import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "./app-header";
import type { TaskStatus } from "./api";
import { useCreateTask, useTasks } from "./queries";
import { TaskForm } from "./task-form";
import { TaskList } from "./task-list";
import { TaskStats } from "./task-stats";

type Filter = "all" | TaskStatus;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chưa hoàn thành" },
  { value: "completed", label: "Đã hoàn thành" },
];

export function TasksPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const tasks = useTasks();
  const createTask = useCreateTask();
  const visibleTasks = tasks.data?.filter((task) => filter === "all" || task.status === filter);

  return (
    <div className="min-h-svh bg-muted">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <TaskStats tasks={tasks.data ?? []} />

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Thêm công việc mới</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              idPrefix="new-task"
              submitLabel="Thêm công việc"
              isPending={createTask.isPending}
              onSubmit={async (input) => {
                await createTask.mutateAsync(input);
                toast.success("Đã thêm công việc");
              }}
            />
          </CardContent>
        </Card>

        <section aria-labelledby="task-list-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="task-list-heading" className="font-medium">
              Danh sách công việc
            </h2>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList aria-label="Lọc theo trạng thái">
                {filters.map(({ value, label }) => (
                  <TabsTrigger key={value} value={value}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <TaskList
            tasks={visibleTasks}
            isPending={tasks.isPending}
            error={tasks.error}
            onRetry={() => void tasks.refetch()}
          />
        </section>
      </main>
    </div>
  );
}
