import { CalendarIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Task } from "./api";
import { formatDate, isOverdue } from "./dates";
import { useDeleteTask, useUpdateTask } from "./queries";
import { TaskForm } from "./task-form";

export function TaskItem({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const completed = task.status === "completed";
  const overdue = isOverdue(task);

  function toggleStatus() {
    updateTask.mutate({ id: task.id, patch: { status: completed ? "pending" : "completed" } });
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <Checkbox
        className="mt-0.5"
        checked={completed}
        disabled={updateTask.isPending}
        onCheckedChange={toggleStatus}
        aria-label={`Đánh dấu "${task.title}" là ${completed ? "chưa hoàn thành" : "đã hoàn thành"}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <h3
          className={cn(
            "font-medium break-words",
            completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className="text-sm whitespace-pre-line break-words text-muted-foreground">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant={completed ? "secondary" : "outline"}>
            {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
          </Badge>
          {task.dueDate && (
            <Badge variant={overdue ? "destructive" : "outline"}>
              <CalendarIcon />
              {formatDate(task.dueDate)}
              {overdue && " · Quá hạn"}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Sửa "${task.title}"`}>
              <PencilIcon />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa công việc</DialogTitle>
              <DialogDescription>Cập nhật tiêu đề, mô tả hoặc hạn chót.</DialogDescription>
            </DialogHeader>
            <TaskForm
              idPrefix={`edit-task-${task.id}`}
              initialValues={task}
              submitLabel="Lưu thay đổi"
              isPending={updateTask.isPending}
              onSubmit={async (input) => {
                await updateTask.mutateAsync({ id: task.id, patch: input });
                toast.success("Đã lưu thay đổi");
                setEditing(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Xóa "${task.title}"`}>
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa công việc này?</AlertDialogTitle>
              <AlertDialogDescription>
                "{task.title}" sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  deleteTask.mutate(task.id, { onSuccess: () => toast.success("Đã xóa công việc") })
                }
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
