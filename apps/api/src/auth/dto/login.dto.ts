import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { normalizeEmail } from "./register.dto.ts";

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Email không hợp lệ" })
  email: string;

  @IsString({ message: "Mật khẩu phải là chuỗi ký tự" })
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu" })
  password: string;
}
