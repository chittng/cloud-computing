import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { register } from "./api";
import { AuthLayout } from "./auth-layout";
import type { LoginLocationState } from "./login-page";
import { type RegisterValues, registerSchema } from "./schemas";

const fields = [
  {
    name: "displayName",
    label: "Tên hiển thị",
    type: "text",
    autoComplete: "name",
    description: "Không bắt buộc.",
  },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  {
    name: "password",
    label: "Mật khẩu",
    type: "password",
    autoComplete: "new-password",
    description: "Từ 8 đến 72 byte.",
  },
  {
    name: "confirmPassword",
    label: "Xác nhận mật khẩu",
    type: "password",
    autoComplete: "new-password",
  },
] as const satisfies ReadonlyArray<{
  name: keyof RegisterValues;
  label: string;
  type: string;
  autoComplete: string;
  description?: string;
}>;

export function RegisterPage() {
  const navigate = useNavigate();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });
  const mutation = useMutation({ mutationFn: register });

  const onSubmit = form.handleSubmit(({ displayName, email, password }) =>
    mutation.mutate(
      { email, password, displayName: displayName || undefined },
      {
        onSuccess: (user) => {
          const state: LoginLocationState = { registeredEmail: user.email };
          void navigate("/login", { state });
        },
      },
    ),
  );

  return (
    <AuthLayout
      title="Tạo tài khoản"
      description="Đăng ký để bắt đầu quản lý công việc."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {mutation.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{mutation.error.message}</AlertDescription>
            </Alert>
          )}
          {fields.map(({ name, label, type, autoComplete, ...rest }) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`register-${name}`}>{label}</FieldLabel>
                  <Input
                    {...field}
                    id={`register-${name}`}
                    type={type}
                    autoComplete={autoComplete}
                    aria-invalid={fieldState.invalid}
                  />
                  {"description" in rest && <FieldDescription>{rest.description}</FieldDescription>}
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ))}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner />}
            Tạo tài khoản
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
