import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { ApiException, type FieldErrorDetail, validationError } from "../common/api-error.ts";
import { isValidEmail, parsePlainJsonObject, pushDetail } from "../common/validation.ts";
import { AuthRepositoryPort } from "./auth.repository.ts";
import type { LoginResponse, RegisterResponse } from "./auth.types.ts";
import { JwtService } from "./jwt.service.ts";

const BCRYPT_ROUNDS = 12;
const MAX_EMAIL_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;
const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không chính xác";
const DUMMY_PASSWORD_HASH = "$2b$12$05YK4ZIWwRU9gkmJSr0Q8uOGGDsQmpLwmb2W8HJEeZxniFPAsuWE2";

interface ValidatedRegisterInput {
  email: string;
  password: string;
  displayName: string | null;
}

interface ValidatedLoginInput {
  email: string;
  password: string;
}

/** Handles registration, credential verification, and JWT issuance. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepositoryPort) private readonly authRepository: AuthRepositoryPort,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async register(rawBody: unknown): Promise<RegisterResponse> {
    const input = this.validateRegisterInput(rawBody);
    const existing = await this.authRepository.findByEmail(input.email);
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email đã được đăng ký");
    }

    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
    return this.authRepository.createUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
  }

  async login(rawBody: unknown): Promise<LoginResponse> {
    const input = this.validateLoginInput(rawBody);
    const user = await this.authRepository.findByEmail(input.email);

    if (!user) {
      await compare(input.password, DUMMY_PASSWORD_HASH);
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "INVALID_CREDENTIALS",
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    const passwordBytes = Buffer.byteLength(input.password, "utf8");
    const passwordMatches =
      passwordBytes <= MAX_PASSWORD_BYTES && (await compare(input.password, user.passwordHash));

    if (!passwordMatches) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "INVALID_CREDENTIALS",
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    const token = this.jwtService.signUserToken(user.id);
    return {
      access_token: token.access_token,
      token_type: "Bearer",
      expires_in: token.expires_in,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
      },
    };
  }

  private validateRegisterInput(rawBody: unknown): ValidatedRegisterInput {
    const body = parsePlainJsonObject(rawBody);
    const details: FieldErrorDetail[] = [];

    const email = this.validateEmailField(body.email, details);

    let password = "";
    if (typeof body.password !== "string") {
      pushDetail(details, "password", "Mật khẩu phải là chuỗi ký tự");
    } else {
      const byteLength = Buffer.byteLength(body.password, "utf8");
      if (body.password.trim().length === 0) {
        pushDetail(details, "password", "Mật khẩu không được để trống");
      } else if (byteLength < MIN_PASSWORD_BYTES || byteLength > MAX_PASSWORD_BYTES) {
        pushDetail(details, "password", "Mật khẩu phải từ 8 đến 72 byte UTF-8");
      } else {
        password = body.password;
      }
    }

    let displayName: string | null = null;
    if (body.display_name !== undefined && body.display_name !== null) {
      if (typeof body.display_name !== "string") {
        pushDetail(details, "display_name", "Tên hiển thị phải là chuỗi ký tự hoặc null");
      } else {
        const trimmedName = body.display_name.trim();
        if (trimmedName.length < 1 || trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
          pushDetail(details, "display_name", "Tên hiển thị phải từ 1 đến 100 ký tự");
        } else {
          displayName = trimmedName;
        }
      }
    }

    if (details.length > 0) {
      throw validationError(details);
    }

    return { email, password, displayName };
  }

  private validateLoginInput(rawBody: unknown): ValidatedLoginInput {
    const body = parsePlainJsonObject(rawBody);
    const details: FieldErrorDetail[] = [];

    const email = this.validateEmailField(body.email, details);

    let password = "";
    if (
      typeof body.password !== "string" ||
      body.password.length === 0 ||
      body.password.trim().length === 0
    ) {
      pushDetail(details, "password", "Mật khẩu không được để trống");
    } else {
      password = body.password;
    }

    if (details.length > 0) {
      throw validationError(details);
    }

    return { email, password };
  }

  private validateEmailField(rawEmail: unknown, details: FieldErrorDetail[]): string {
    if (typeof rawEmail !== "string") {
      pushDetail(details, "email", "Email phải là chuỗi ký tự");
      return "";
    }
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized) {
      pushDetail(details, "email", "Email không được để trống");
      return "";
    }
    if (normalized.length > MAX_EMAIL_LENGTH || !isValidEmail(normalized)) {
      pushDetail(details, "email", "Email không hợp lệ hoặc vượt quá 255 ký tự");
      return "";
    }
    return normalized;
  }
}
