import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import {
  createTask,
  deleteTask,
  fetchTasks,
  type TaskInput,
  type TaskPatch,
  updateTask,
} from "./api";

/** Keyed by user so one account never sees another's cached tasks. */
function useTasksKey() {
  const { user } = useSession();
  return ["tasks", user.id] as const;
}

export function useTasks() {
  const { accessToken } = useSession();
  return useQuery({ queryKey: useTasksKey(), queryFn: () => fetchTasks(accessToken) });
}

/** Wraps a task mutation: refetches the list on success and reports failures in a toast. */
function useTaskMutation<TVariables, TResult>(
  mutate: (token: string, variables: TVariables) => Promise<TResult>,
) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const queryKey = useTasksKey();
  return useMutation({
    mutationFn: (variables: TVariables) => mutate(accessToken, variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      // An expired session signs the user out instead (see QueryProvider).
      if (!(error instanceof ApiError && error.sessionExpired)) toast.error(error.message);
    },
  });
}

export function useCreateTask() {
  return useTaskMutation((token, input: TaskInput) => createTask(token, input));
}

export function useUpdateTask() {
  return useTaskMutation((token, { id, patch }: { id: number; patch: TaskPatch }) =>
    updateTask(token, id, patch),
  );
}

export function useDeleteTask() {
  return useTaskMutation((token, id: number) => deleteTask(token, id));
}
