import { Transform } from "class-transformer";
import { IsByteLength, IsEmail, IsOptional, IsString, Length, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Email không hợp lệ" })
  @MaxLength(255, { message: "Email tối đa 255 ký tự" })
  email: string;

  /** bcrypt only uses the first 72 bytes, so longer passwords are rejected. */
  @IsString({ message: "Mật khẩu phải là chuỗi ký tự" })
  @IsByteLength(8, 72, { message: "Mật khẩu phải dài từ 8 đến 72 byte" })
  password: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Tên hiển thị phải là chuỗi ký tự" })
  @Length(1, 100, { message: "Tên hiển thị dài từ 1 đến 100 ký tự" })
  displayName?: string | null;
}
