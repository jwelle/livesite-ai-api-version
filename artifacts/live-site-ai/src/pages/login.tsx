import { useState } from "react";
import { Link, Redirect } from "wouter";
import {
  loginWithGoogle,
  loginWithPassword,
  takeReturnTo,
  useAuth,
} from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Code2, Chrome } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && isAuthenticated) {
    return <Redirect to={takeReturnTo("/dashboard")} />;
  }

  const returnTo =
    new URLSearchParams(window.location.search).get("returnTo") || "/dashboard";

  async function handlePasswordLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithPassword({ email, password });
    } catch (err) {
      setError((err as Error).message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(returnTo);
    } catch (err) {
      setError((err as Error).message || "Unable to start Google sign-in.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="bg-card/80 backdrop-blur border-border shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">
                Welcome Back
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Sign in to your Live Site AI dashboard
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@agency.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>

            <Button
              onClick={handlePasswordLogin}
              className="w-full h-12 text-base font-medium"
              disabled={submitting || !email || !password}
              data-testid="btn-login"
            >
              Sign in with email
            </Button>

            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full h-12 text-base font-medium"
              disabled={submitting}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Need an account?{" "}
              <Link href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>
                <span className="text-primary underline-offset-4 hover:underline">
                  Create one
                </span>
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
