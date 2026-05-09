import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import type { Session } from "@supabase/supabase-js";
import {
  authFetch,
  clearInviteToken,
  finalizeInviteIfNeeded,
  getSupabaseClient,
  storeInviteToken,
  storeReturnTo,
} from "./client";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  tier: "free" | "pro" | null;
  status: "active" | "suspended" | "pending_approval" | null;
  impersonating: { targetUserId: string; targetEmail: string | null } | null;
  refresh: () => Promise<void>;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
}

interface LoginOptions {
  email: string;
  password: string;
}

interface SignupOptions extends LoginOptions {
  inviteToken?: string | null;
  returnTo?: string | null;
}

export type OAuthProvider = "google";

async function fetchMe(): Promise<AuthUser | null> {
  const response = await authFetch("/api/auth/user");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

async function syncSession(session: Session | null): Promise<AuthUser | null> {
  if (!session) return null;
  await finalizeInviteIfNeeded(session).catch(() => null);
  return fetchMe();
}

export async function loginWithPassword(options: LoginOptions) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: options.email,
    password: options.password,
  });
  if (error) throw error;
}

export async function signUpWithPassword(options: SignupOptions) {
  if (options.inviteToken) {
    storeInviteToken(options.inviteToken);
  }
  if (options.returnTo) {
    storeReturnTo(options.returnTo);
  }
  const { error } = await getSupabaseClient().auth.signUp({
    email: options.email,
    password: options.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function loginWithGoogle(
  returnTo?: string,
  inviteToken?: string | null,
) {
  if (inviteToken) {
    storeInviteToken(inviteToken);
  }
  if (returnTo) {
    storeReturnTo(returnTo);
  }
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      const { data } = await client.auth.getSession();
      setSession(data.session);
      if (!data.session) {
        setUser(null);
        return;
      }
      const resolvedUser = await syncSession(data.session);
      setUser(resolvedUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    let cancelled = false;

    client.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (!data.session) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        try {
          const resolvedUser = await syncSession(data.session);
          if (!cancelled) {
            setUser(resolvedUser);
          }
        } catch {
          if (!cancelled) setUser(null);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        void (async () => {
          if (!nextSession) {
            clearInviteToken();
            setUser(null);
            setIsLoading(false);
            return;
          }
          setIsLoading(true);
          try {
            const resolvedUser = await syncSession(nextSession);
            if (!cancelled) {
              setUser(resolvedUser);
            }
          } catch {
            if (!cancelled) {
              setUser(null);
            }
          } finally {
            if (!cancelled) {
              setIsLoading(false);
            }
          }
        })();
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback((returnTo?: string) => {
    if (returnTo) {
      storeReturnTo(returnTo);
    }
    window.location.href = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort cleanup of server-side impersonation state.
    }
    await getSupabaseClient().auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
  }, []);

  return useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!session && !!user,
      isAdmin: user?.role === "admin",
      tier: (user?.tier as "free" | "pro" | undefined) ?? null,
      status: (user?.status as AuthState["status"]) ?? null,
      impersonating: user?.impersonating ?? null,
      refresh,
      login,
      logout,
    }),
    [user, isLoading, session, refresh, login, logout],
  );
}
