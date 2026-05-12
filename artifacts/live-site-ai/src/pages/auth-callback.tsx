import { useEffect, useMemo } from "react";
import { Redirect } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { takeReturnTo, useAuth } from "@workspace/replit-auth-web";

export default function AuthCallback() {
  const { isLoading, isAuthenticated } = useAuth();
  const destination = useMemo(() => takeReturnTo("/dashboard"), []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace(destination === "/dashboard" ? "/login" : destination);
    }
  }, [destination, isAuthenticated, isLoading]);

  if (isAuthenticated) {
    return <Redirect to={destination} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}
