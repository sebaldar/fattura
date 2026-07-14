import { api } from "./api";

export interface LoginResponse {
  totpRequired: boolean;
  totpSetupRequired: boolean;
  totpSecret?: string;
  totpUri?: string;
}

export interface MeResponse {
  id: string;
  email: string;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>("/api/auth/login", { email, password });
}

export function activateTotp(code: string): Promise<{ email: string }> {
  return api.post("/api/auth/totp/activate", { code });
}

export function verifyTotp(code: string): Promise<{ email: string }> {
  return api.post("/api/auth/totp/verify", { code });
}

export function logout(): Promise<void> {
  return api.post("/api/auth/logout");
}

export function me(): Promise<MeResponse> {
  return api.get<MeResponse>("/api/auth/me");
}
