import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TaskInput } from "./api";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(255, "Tiêu đề tối đa 255 ký tự"),
  description: z.string().max(10_000, "Mô tả tối đa 10.000 ký tự"),
  dueDate: z.string(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  /** Distinguishes field ids when several forms are on the page. */
  idPrefix: string;
  initialValues?: TaskInput;
  submitLabel: string;
  isPending: boolean;
  /** Resolve to clear the form, reject to keep the user's input. */
  onSubmit: (input: TaskInput) => Promise<unknown>;
}

export function TaskForm({
  idPrefix,
  initialValues,
  submitLabel,
  isPending,
  onSubmit,
}: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      dueDate: initialValues?.dueDate ?? "",
    },
  });

  const submit = form.handleSubmit(async ({ title, description, dueDate }) => {
    try {
      await onSubmit({ title, description: description || null, dueDate: dueDate || null });
      if (!initialValues) form.reset();
    } catch {
      // The caller reports the error; keep the input so the user can retry.
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-title`}>Tiêu đề</FieldLabel>
              <Input
                {...field}
                id={`${idPrefix}-title`}
                placeholder="Ví dụ: Hoàn thành báo cáo"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-description`}>Mô tả</FieldLabel>
              <Textarea
                {...field}
                id={`${idPrefix}-description`}
                placeholder="Không bắt buộc"
                rows={3}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="dueDate"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-due-date`}>Hạn chót</FieldLabel>
              <Input {...field} id={`${idPrefix}-due-date`} type="date" className="w-fit" />
            </Field>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending && <Spinner />}
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
