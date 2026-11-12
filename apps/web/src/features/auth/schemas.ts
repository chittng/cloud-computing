import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email")
  .max(255, "Email tối đa 255 ký tự")
  .pipe(z.email("Email không hợp lệ"));

/** bcrypt on the server only uses the first 72 bytes of a password. */
const byteLength = (value: string) => new TextEncoder().encode(value).length;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z.string().trim().max(100, "Tên hiển thị tối đa 100 ký tự"),
    email,
    password: z
      .string()
      .refine(
        (value) => byteLength(value) >= 8 && byteLength(value) <= 72,
        "Mật khẩu phải dài từ 8 đến 72 byte",
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
