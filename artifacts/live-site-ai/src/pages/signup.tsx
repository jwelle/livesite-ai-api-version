import { useEffect, useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import {
  loginWithGoogle,
  signUpWithPassword,
  storeInviteToken,
  takeReturnTo,
  useAuth,
} from "@workspace/replit-auth-web";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Chrome, Sparkles } from "lucide-react";

interface InviteStatusResponse {
  invite?: {
    token: string;
    tier: string;
    invitedEmail: string | null;
    expiresAt: string | null;
    consumedAt: string | null;
    revokedAt: string | null;
  };
  status?: string;
  message?: string;
}

export default function Signup() {
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteStatusResponse | null>(null);

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const returnTo = params.get("returnTo") || "/dashboard";

  useEffect(() => {
    if (!inviteToken) return;
    storeInviteToken(inviteToken);
    void fetch(`/api/auth/invite-status?token=${encodeURIComponent(inviteToken)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as InviteStatusResponse;
        if (!response.ok) {
          setInviteInfo(payload);
          return;
        }
        setInviteInfo(payload);
      })
      .catch(() => {
        setInviteInfo({
          status: "error",
          message: "We couldn't verify that invite right now.",
        });
      });
  }, [inviteToken]);

  if (!isLoading && isAuthenticated) {
    return <Redirect to={takeReturnTo("/dashboard")} />;
  }

  async function handleEmailSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("email") ?? "").trim();
    const nextPassword = String(form.get("password") ?? "");
    setEmail(nextEmail);
    setPassword(nextPassword);
    if (!nextEmail || !nextPassword) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await signUpWithPassword({
        email: nextEmail,
        password: nextPassword,
        inviteToken,
        returnTo,
      });
      setSuccessMessage(
        "Account created. If email confirmation is enabled, check your inbox for the verification link before signing in.",
      );
    } catch (err) {
      setError((err as Error).message || "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignup() {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(returnTo, inviteToken);
    } catch (err) {
      setError((err as Error).message || "Unable to start Google sign-up.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card className="border-border bg-card/80 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium tracking-wide uppercase text-xs">
                Live Site AI Access
              </span>
            </div>
            <div className="text-center">
              <CardTitle className="text-3xl font-bold tracking-tight">
                Create your account
              </CardTitle>
              <p className="mt-2 text-muted-foreground">
                Start building client-ready AI demo pages.
              </p>
            </div>
            {inviteToken && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Invite</Badge>
                  {inviteInfo?.invite?.tier && (
                    <Badge variant="outline">
                      {inviteInfo.invite.tier === "pro" ? "Pro access" : "Free access"}
                    </Badge>
                  )}
                </div>
                {inviteInfo?.invite?.invitedEmail && (
                  <p className="text-sm text-muted-foreground">
                    This invite is reserved for {inviteInfo.invite.invitedEmail}.
                  </p>
                )}
                {inviteInfo?.message && (
                  <p className="text-sm text-muted-foreground">{inviteInfo.message}</p>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Sign-up failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert>
                <AlertTitle>Check your inbox</AlertTitle>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-5" onSubmit={handleEmailSignup}>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  autoComplete="email"
                  placeholder="you@agency.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                  autoComplete="new-password"
                  placeholder="Create a password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={submitting}
              >
                Create account with email
              </Button>
            </form>

            <Button
              variant="outline"
              onClick={handleGoogleSignup}
              className="w-full h-12 text-base font-medium"
              disabled={submitting}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
              >
                <span className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </span>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
