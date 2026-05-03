import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable, userInvitesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import { isBootstrapAdmin, logAdminAction } from "../services/audit";
import { getUsageSnapshot } from "../services/usageService";
import { requireActiveUser } from "../middlewares/authMiddleware";
import { config as appConfig } from "../lib/config";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const INVITE_COOKIE_TTL = 30 * 60 * 1000;
const INVITE_COOKIE = "invite_token";

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function setInviteCookie(res: Response, token: string) {
  res.cookie(INVITE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

interface InviteResolution {
  invite: typeof userInvitesTable.$inferSelect | null;
  /** Error code if a token was provided but is not usable. */
  error?: "INVITE_INVALID" | "INVITE_EXPIRED" | "INVITE_CONSUMED" | "INVITE_REVOKED" | "INVITE_EMAIL_MISMATCH";
}

async function resolveInvite(token: string | undefined | null, email: string | null): Promise<InviteResolution> {
  if (!token || typeof token !== "string") return { invite: null };
  const [row] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.token, token));
  if (!row) return { invite: null, error: "INVITE_INVALID" };
  if (row.revokedAt) return { invite: null, error: "INVITE_REVOKED" };
  if (row.consumedAt) return { invite: null, error: "INVITE_CONSUMED" };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { invite: null, error: "INVITE_EXPIRED" };
  }
  if (row.invitedEmail && email && row.invitedEmail.toLowerCase() !== email.toLowerCase()) {
    return { invite: null, error: "INVITE_EMAIL_MISMATCH" };
  }
  return { invite: row };
}

/**
 * Atomically mark an invite as consumed by the given user. Returns true if the
 * caller "won" the consumption race; false otherwise.
 */
async function consumeInvite(token: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(userInvitesTable)
    .set({ consumedAt: new Date(), consumedByUserId: userId })
    .where(
      sql`${userInvitesTable.token} = ${token} AND ${userInvitesTable.consumedAt} IS NULL AND ${userInvitesTable.revokedAt} IS NULL`,
    )
    .returning({ id: userInvitesTable.id });
  return updated.length > 0;
}

async function upsertUser(
  claims: Record<string, unknown>,
  options: { invite?: typeof userInvitesTable.$inferSelect | null } = {},
) {
  const id = claims.sub as string;
  const email = ((claims.email as string) || null);

  // First, see whether an admin pre-created a record for this email (manual
  // add). If so, claim that row by updating its id to match the OIDC sub.
  if (email) {
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = lower(${email})`);
    if (byEmail && byEmail.id !== id) {
      // Avoid clobbering an existing oidc-bound row with the same id (rare).
      const [byId] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      if (!byId) {
        await db
          .update(usersTable)
          .set({
            id,
            firstName: (claims.first_name as string) || byEmail.firstName,
            lastName: (claims.last_name as string) || byEmail.lastName,
            profileImageUrl:
              ((claims.profile_image_url || claims.picture) as string | null) ||
              byEmail.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, byEmail.id));
      }
    }
  }

  const userData = {
    id,
    email,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  // Determine whether this is a brand-new user before we insert.
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  const isNew = !existing;

  // Decide the initial status/tier for new users.
  let initialStatus: string | undefined;
  let initialTier: string | undefined;
  if (isNew) {
    if (options.invite) {
      initialStatus = "active";
      initialTier = options.invite.tier === "pro" ? "pro" : "free";
    } else if (!appConfig.signupsRequireApproval) {
      initialStatus = "active";
      initialTier = "free";
    } else {
      initialStatus = "pending_approval";
      initialTier = "free";
    }
  }

  // Bootstrap-admin promotion: env-listed emails OR (when env is empty) the
  // very first user to ever sign in.
  let promoteToAdmin = false;
  if (isBootstrapAdmin(email)) {
    promoteToAdmin = true;
  } else if (isNew && appConfig.initialAdminEmails.length === 0) {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
    if (c === 0) promoteToAdmin = true;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      ...userData,
      ...(initialStatus ? { status: initialStatus } : {}),
      ...(initialTier ? { tier: initialTier } : {}),
      ...(promoteToAdmin ? { role: "admin", status: "active" } : {}),
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();

  // If the user already existed but matches a bootstrap-admin email, ensure
  // they're an admin and active.
  if (!isNew && promoteToAdmin && (user.role !== "admin" || user.status !== "active")) {
    const [promoted] = await db
      .update(usersTable)
      .set({ role: "admin", status: "active" })
      .where(eq(usersTable.id, user.id))
      .returning();
    return { user: promoted ?? user, isNew, promotedToAdmin: true };
  }

  return { user, isNew, promotedToAdmin: promoteToAdmin };
}

function buildAuthPayload(req: Request) {
  if (!req.isAuthenticated()) return { user: null };
  const u = req.user;
  return {
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      role: u.role ?? "user",
      status: u.status ?? "active",
      tier: u.tier ?? "free",
      impersonating: req.impersonation
        ? {
            targetUserId: req.impersonation.targetUserId,
            targetEmail: req.impersonation.targetEmail,
          }
        : null,
    },
  };
}

router.get("/auth/me", (req: Request, res: Response) => {
  res.json(buildAuthPayload(req));
});

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(buildAuthPayload(req));
});

// --- Usage / quota snapshot for the current user ---------------------------
router.get("/me/usage", requireActiveUser, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  // Use req.user (the impersonated identity if any) so the dashboard's usage
  // badge reflects what an admin "viewing as user" actually sees. When not
  // impersonating, req.user === req.realUser.
  const baseUser = req.user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, baseUser.id));
  if (!dbUser) {
    res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    return;
  }
  const snapshot = await getUsageSnapshot(dbUser);
  res.json(snapshot);
});

// --- Invite-link signup entry point ----------------------------------------
// This is hit by the frontend "Request Access" / signup page when the URL
// contains ?invite=<token>. We stash the token in a short-lived cookie and
// fall through to /api/login so the user authenticates via Replit OIDC. The
// callback handler consumes the cookie.
router.get("/signup", async (req: Request, res: Response) => {
  const invite = typeof req.query.invite === "string" ? req.query.invite : "";
  if (invite) setInviteCookie(res, invite);
  const returnTo = getSafeReturnTo(req.query.returnTo);
  res.redirect(`/api/login?returnTo=${encodeURIComponent(returnTo)}`);
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  const inviteToken: string | undefined = req.cookies?.[INVITE_COOKIE];

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });
  res.clearCookie(INVITE_COOKIE, { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const email = (claims.email as string) || null;

  // Resolve invite (if any) BEFORE upserting so the new user is created with
  // the right tier/status atomically.
  // Resolve invite *before* upserting and atomically consume it for the
  // prospective user id (the OIDC sub) so two concurrent signups against the
  // same invite can't both end up active. Only the winner gets the invite's
  // tier + active status; the loser falls through to the normal pending path.
  let inviteResolution = await resolveInvite(inviteToken, email);
  if (inviteResolution.invite) {
    const claimsSub = (claims as Record<string, unknown>).sub as string | undefined;
    if (claimsSub) {
      const won = await consumeInvite(inviteResolution.invite.token, claimsSub);
      if (!won) {
        // Lost the race; another signup already consumed this invite.
        inviteResolution = { invite: null, error: "INVITE_CONSUMED" };
      }
    }
  }
  if (inviteToken && inviteResolution.error) {
    // Sign the user in normally (no invite consumed). The "request access"
    // page will surface a banner when next loaded — for now we just attach
    // a query string the frontend can read.
    const upserted = await upsertUser(claims as unknown as Record<string, unknown>);
    await issueSessionAndRedirect(res, upserted.user, tokens, claims.exp, `${returnTo}${returnTo.includes("?") ? "&" : "?"}invite_error=${inviteResolution.error}`);
    return;
  }

  const upserted = await upsertUser(
    claims as unknown as Record<string, unknown>,
    { invite: inviteResolution.invite },
  );

  // We already won the consumeInvite race above, so just record the audit
  // entry and ensure the consumed_by_user_id field reflects the actual user.
  if (inviteResolution.invite) {
    await db
      .update(userInvitesTable)
      .set({ consumedByUserId: upserted.user.id })
      .where(eq(userInvitesTable.token, inviteResolution.invite.token));
    await logAdminAction({
      actorId: inviteResolution.invite.createdBy,
      actorEmail: null,
      action: "invite_consumed",
      targetType: "user",
      targetId: upserted.user.id,
      details: {
        token: inviteResolution.invite.token,
        tier: inviteResolution.invite.tier,
        email: upserted.user.email,
      },
    });
  }

  await issueSessionAndRedirect(res, upserted.user, tokens, claims.exp, returnTo);
});

async function issueSessionAndRedirect(
  res: Response,
  dbUser: { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null },
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  exp: number | undefined,
  returnTo: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : exp,
  };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
}

router.get("/auth/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const sid = getSessionId(req);
  await clearSession(res, sid);
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });
  res.redirect(endSessionUrl.href);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const sid = getSessionId(req);
  await clearSession(res, sid);
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });
  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const upserted = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: upserted.user.id,
          email: upserted.user.email,
          firstName: upserted.user.firstName,
          lastName: upserted.user.lastName,
          profileImageUrl: upserted.user.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
