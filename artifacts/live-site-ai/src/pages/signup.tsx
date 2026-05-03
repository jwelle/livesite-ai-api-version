import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Signup() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      // Hand off to backend so it can stash the invite cookie and redirect
      // through OIDC. Full page nav is required.
      window.location.href = `/api/signup?invite=${encodeURIComponent(invite)}`;
      return;
    }
    setLocation("/login");
  }, [setLocation]);

  return null;
}
