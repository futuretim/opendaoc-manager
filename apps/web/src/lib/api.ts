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

// --- Accounts --------------------------------------------------------------

export interface AccountSummary {
  name: string;
  privLevel: number;
  realm: number;
  creationDate: string | null;
  lastLogin: string | null;
  discordId: string | null;
}

export interface AccountDetail extends AccountSummary {
  status: number;
  isMuted: boolean;
  isWarned: boolean;
  isTester: boolean;
  notes: string | null;
  mail: string | null;
  lastLoginIP: string | null;
  lastClientVersion: string | null;
}

export interface AccountUpdate {
  privLevel?: number;
  status?: number;
  isMuted?: boolean;
  isWarned?: boolean;
  isTester?: boolean;
  notes?: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const accountsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: AccountSummary[]; page: number; pageSize: number }>(
      `/accounts${qs({ query, page })}`,
    ),
  get: (name: string) =>
    apiFetch<{ account: AccountDetail; characters: CharacterSummary[]; bans: Ban[] }>(
      `/accounts/${encodeURIComponent(name)}`,
    ),
  resetPassword: (name: string, password: string) =>
    apiFetch<{ ok: true }>(`/accounts/${encodeURIComponent(name)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  update: (name: string, updates: AccountUpdate) =>
    apiFetch<{ account: AccountDetail }>(`/accounts/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
};

// --- Characters ------------------------------------------------------------

export interface CharacterSummary {
  name: string;
  accountName: string;
  level: number;
  class: number;
  race: number;
  realm: number;
  lastPlayed: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  accountSlot: number;
  realmLevel: number;
  realmPoints: number;
}

export const charactersApi = {
  search: (query: string, realm: number | undefined, page = 1) =>
    apiFetch<{ items: CharacterSummary[]; page: number; pageSize: number }>(
      `/characters${qs({ query, realm, page })}`,
    ),
  get: (name: string) =>
    apiFetch<{ character: CharacterDetail }>(`/characters/${encodeURIComponent(name)}`),
};

// --- Bans ------------------------------------------------------------------

export type BanType = "A" | "I" | "B";

export interface Ban {
  id: string;
  author: string;
  type: BanType;
  ip: string;
  account: string;
  dateBan: string | null;
  reason: string;
}

export interface BanCreate {
  type: BanType;
  account?: string;
  ip?: string;
  reason: string;
}

export const bansApi = {
  list: (type: BanType | "" = "", page = 1) =>
    apiFetch<{ items: Ban[]; page: number; pageSize: number }>(
      `/bans${qs({ type: type || undefined, page })}`,
    ),
  create: (ban: BanCreate) =>
    apiFetch<{ ban: Ban }>("/bans", { method: "POST", body: JSON.stringify(ban) }),
  lift: (id: string) =>
    apiFetch<{ ok: true }>(`/bans/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/** Human-readable realm names (DAoC). */
export const REALM_NAMES: Record<number, string> = {
  0: "None",
  1: "Albion",
  2: "Midgard",
  3: "Hibernia",
};

export const PRIV_LEVEL_NAMES: Record<number, string> = {
  1: "Player",
  2: "GM",
  3: "Admin",
};
