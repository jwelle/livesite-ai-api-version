import { useAuth } from "@workspace/replit-auth-web";
import { exitImpersonation } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function ImpersonationBanner() {
  const { impersonating, refresh } = useAuth();
  const exit = useMutation({
    mutationFn: () => exitImpersonation(),
    onSuccess: async () => {
      await refresh();
      window.location.href = "/admin/users";
    },
  });

  if (!impersonating) return null;

  return (
    <div
      className="w-full bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium z-50"
      data-testid="banner-impersonation"
    >
      <span>
        Viewing as <strong>{impersonating.targetEmail ?? impersonating.targetUserId}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="bg-white hover:bg-amber-50 border-amber-700 text-amber-900 h-7"
        onClick={() => exit.mutate()}
        disabled={exit.isPending}
        data-testid="btn-exit-impersonation"
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        Exit
      </Button>
    </div>
  );
}
