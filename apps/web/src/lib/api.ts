const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thin fetch wrapper for the Manager API. Always sends cookies (the session)
 * and normalizes the API's `{ error: { code, message } }` envelope into an
 * ApiError.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const code = body?.error?.code ?? "error";
    const message = body?.error?.message ?? res.statusText;
    throw new ApiError(res.status, code, message);
  }

  return body as T;
}

export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "gm";
}

export const authApi = {
  me: () => apiFetch<{ user: AuthUser }>("/auth/me"),
  login: (email: string, password: string) =>
    apiFetch<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
};
