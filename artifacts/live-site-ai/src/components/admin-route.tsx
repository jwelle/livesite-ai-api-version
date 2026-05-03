import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { ReactNode } from "react";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, isAdmin, login } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      login(location);
      return;
    }
    if (!isAdmin) {
      setLocation("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdmin, location, login, setLocation]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
