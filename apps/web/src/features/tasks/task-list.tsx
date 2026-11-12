import { CircleAlertIcon, ListTodoIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "./api";
import { TaskItem } from "./task-item";

interface TaskListProps {
  tasks: Task[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function TaskList({ tasks, isPending, error, onRetry }: TaskListProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-label="Đang tải công việc">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertDescription>{error.message}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (!tasks?.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListTodoIcon />
          </EmptyMedia>
          <EmptyTitle>Không có công việc nào</EmptyTitle>
          <EmptyDescription>Công việc bạn thêm sẽ hiển thị ở đây.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}
