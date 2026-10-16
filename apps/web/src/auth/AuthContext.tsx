import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { ApiError, authApi, type AuthUser } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const res = await authApi.me();
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      queryClient.setQueryData(["auth", "me"], res.user);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.clear();
  }, [queryClient]);

  const value: AuthState = {
    user: data ?? null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
