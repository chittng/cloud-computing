import type { Request } from "express";

export interface AuthenticatedUser {
  id: number;
  email: string;
  display_name: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface UserAuthRecord {
  id: number;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: AuthenticatedUser;
}
