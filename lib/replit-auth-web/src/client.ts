import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

interface AuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiBaseUrl?: string | null;
}

const INVITE_TOKEN_KEY = "live-site-ai:invite-token";
const RETURN_TO_KEY = "live-site-ai:return-to";

let supabaseClient: SupabaseClient | null = null;
let configuredSupabaseUrl: string | null = null;
let configuredApiBaseUrl: string | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function configureAuth(config: AuthConfig) {
  const supabaseUrl = trimTrailingSlash(config.supabaseUrl);
  const apiBaseUrl = config.apiBaseUrl ? trimTrailingSlash(config.apiBaseUrl) : null;

  if (supabaseClient && configuredSupabaseUrl === supabaseUrl) {
    configuredApiBaseUrl = apiBaseUrl;
    setBaseUrl(apiBaseUrl);
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  configuredSupabaseUrl = supabaseUrl;
  configuredApiBaseUrl = apiBaseUrl;

  setBaseUrl(apiBaseUrl);
  setAuthTokenGetter(async () => {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token ?? null;
  });

  return supabaseClient;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    throw new Error(
      "Auth has not been configured. Call configureAuth() before rendering the app.",
    );
  }
  return supabaseClient;
}

export async function getAccessToken() {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const requestInfo =
    configuredApiBaseUrl && typeof input === "string" && input.startsWith("/")
      ? `${configuredApiBaseUrl}${input}`
      : input;
  return fetch(requestInfo, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}

export function storeInviteToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(INVITE_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(INVITE_TOKEN_KEY, token);
}

export function getInviteToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(INVITE_TOKEN_KEY);
}

export function clearInviteToken() {
  storeInviteToken(null);
}

export function storeReturnTo(path: string | null) {
  if (typeof window === "undefined") return;
  if (!path) {
    window.sessionStorage.removeItem(RETURN_TO_KEY);
    return;
  }
  window.sessionStorage.setItem(RETURN_TO_KEY, path);
}

export function takeReturnTo(defaultPath = "/dashboard") {
  if (typeof window === "undefined") return defaultPath;
  const fromQuery = new URLSearchParams(window.location.search).get("returnTo");
  const stored = window.sessionStorage.getItem(RETURN_TO_KEY);
  const candidate = fromQuery || stored || defaultPath;
  window.sessionStorage.removeItem(RETURN_TO_KEY);
  return candidate.startsWith("/") ? candidate : defaultPath;
}

export async function finalizeInviteIfNeeded(session: Session | null) {
  const inviteToken = getInviteToken();
  if (!session || !inviteToken) return null;

  const response = await authFetch("/api/auth/finalize-invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviteToken }),
  });

  if (response.ok) {
    clearInviteToken();
    return response.json();
  }

  if ([400, 401, 403, 404].includes(response.status)) {
    const error = await response.json().catch(() => null);
    clearInviteToken();
    throw new Error(error?.message ?? `Invite finalization failed (${response.status})`);
  }

  throw new Error(`Invite finalization failed (${response.status})`);
}
