import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ShieldX } from "lucide-react";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, status, logout, isAdmin } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation(`/login?returnTo=${encodeURIComponent(location)}`);
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Admins can always pass — pending/suspended UI only applies to non-admins.
  if (!isAdmin && status === "pending_approval") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-yellow-500" />
              <CardTitle>Waiting for approval</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account has been created but is awaiting admin approval. You'll
              receive access as soon as an admin reviews your request.
            </p>
            <Button variant="outline" onClick={logout} data-testid="btn-logout-pending">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin && status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-destructive" />
              <CardTitle>Account suspended</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account is currently suspended. Please contact an admin if you
              believe this is in error.
            </p>
            <Button variant="outline" onClick={logout} data-testid="btn-logout-suspended">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
