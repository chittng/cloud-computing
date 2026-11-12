import { apiRequest } from "@/lib/api";

export interface User {
  id: number;
  email: string;
  displayName: string | null;
}

export interface LoginResponse {
  accessToken: string;
  /** Token lifetime in seconds. */
  expiresIn: number;
  user: User;
}

export function login(input: { email: string; password: string }): Promise<LoginResponse> {
  return apiRequest("/auth/login", { method: "POST", body: input });
}

export function register(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<User> {
  return apiRequest("/auth/register", { method: "POST", body: input });
}
