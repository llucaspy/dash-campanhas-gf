"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UserRole = "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
  hasSeenWelcome?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string, options?: { deferUser?: boolean }) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setUser(data.user && !data.user.mustChangePassword ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username: string, password: string, options: { deferUser?: boolean } = {}) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: data.error || "Falha ao autenticar." };
    }

    if (!data.user?.mustChangePassword) {
      setUser(data.user);
    }
    return { ok: true, user: data.user };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "ADMIN",
      login,
      logout,
      refresh,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
