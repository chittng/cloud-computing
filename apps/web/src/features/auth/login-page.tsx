import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { login } from "./api";
import { useAuth } from "./auth-context";
import { AuthLayout } from "./auth-layout";
import { type LoginValues, loginSchema } from "./schemas";

/** Set by the registration page after an account is created. */
export interface LoginLocationState {
  registeredEmail?: string;
}

export function LoginPage() {
  const { signIn, sessionExpired } = useAuth();
  const registeredEmail = (useLocation().state as LoginLocationState | null)?.registeredEmail;

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: registeredEmail ?? "", password: "", remember: true },
  });
  const mutation = useMutation({ mutationFn: login });

  const onSubmit = form.handleSubmit(({ email, password, remember }) =>
    mutation.mutate({ email, password }, { onSuccess: (response) => signIn(response, remember) }),
  );

  return (
    <AuthLayout
      title="Đăng nhập"
      description="Nhập email và mật khẩu để quản lý công việc của bạn."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {mutation.error ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{mutation.error.message}</AlertDescription>
            </Alert>
          ) : registeredEmail ? (
            <Alert>
              <CircleCheckIcon />
              <AlertDescription>Tạo tài khoản thành công. Hãy đăng nhập.</AlertDescription>
            </Alert>
          ) : sessionExpired ? (
            <Alert>
              <CircleAlertIcon />
              <AlertDescription>
                Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
              </AlertDescription>
            </Alert>
          ) : null}

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@example.com"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-password">Mật khẩu</FieldLabel>
                <Input
                  {...field}
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="remember"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="login-remember"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  Ghi nhớ đăng nhập
                </FieldLabel>
              </Field>
            )}
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner />}
            Đăng nhập
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
