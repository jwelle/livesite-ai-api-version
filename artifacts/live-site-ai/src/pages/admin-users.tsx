import { useState } from "react";
import {
  useGetAdminUsers,
  useSuspendUser,
  useReactivateUser,
  usePromoteUser,
  useDemoteUser,
  useStartImpersonation,
  getGetAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import { MoreHorizontal, Shield, ShieldOff, UserX, UserCheck, Eye } from "lucide-react";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useGetAdminUsers({ page, pageSize, search });
  const { user, refresh } = useAuth();

  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });

  const suspend = useSuspendUser();
  const reactivate = useReactivateUser();
  const promote = usePromoteUser();
  const demote = useDemoteUser();
  const impersonate = useStartImpersonation();

  const handle = (
    action: () => Promise<unknown>,
    successMsg: string,
  ) => {
    action()
      .then(() => {
        toast({ title: successMsg });
        invalidate();
      })
      .catch((err: Error) => {
        toast({ title: "Action failed", description: err.message, variant: "destructive" });
      });
  };

  const startImpersonate = (id: string) => {
    impersonate.mutate({ userId: id }, {
      onSuccess: async () => {
        await refresh();
        window.location.href = "/dashboard";
      },
      onError: (err) => {
        toast({ title: "Failed to start", description: (err as Error).message, variant: "destructive" });
      },
    });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage every account on the platform.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>All users ({total})</CardTitle>
          <Input
            placeholder="Search email or name..."
            className="max-w-sm"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            data-testid="input-search-users"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Demos</TableHead>
                    <TableHead>Signed up</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell className="font-medium">{u.email ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : "destructive"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.demoCount > 0 && u.email ? (
                            <a
                              href={`/admin/demos?ownerEmail=${encodeURIComponent(u.email)}`}
                              className="hover:underline"
                              data-testid={`link-user-demos-${u.id}`}
                            >
                              {u.demoCount}
                            </a>
                          ) : (
                            u.demoCount
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(u.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.lastActivity
                            ? format(new Date(u.lastActivity), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                data-testid={`btn-user-actions-${u.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isSelf && (
                                <DropdownMenuItem
                                  onClick={() => startImpersonate(u.id)}
                                  data-testid={`btn-impersonate-${u.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View as user
                                </DropdownMenuItem>
                              )}
                              {u.status === "active" ? (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    confirm(`Suspend ${u.email}?`) &&
                                    handle(
                                      () => suspend.mutateAsync({ id: u.id }),
                                      "User suspended",
                                    )
                                  }
                                  data-testid={`btn-suspend-${u.id}`}
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handle(
                                      () => reactivate.mutateAsync({ id: u.id }),
                                      "User reactivated",
                                    )
                                  }
                                  data-testid={`btn-reactivate-${u.id}`}
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              {u.role === "admin" ? (
                                !isSelf && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handle(
                                        () => demote.mutateAsync({ id: u.id }),
                                        "Admin demoted",
                                      )
                                    }
                                    data-testid={`btn-demote-${u.id}`}
                                  >
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Remove admin
                                  </DropdownMenuItem>
                                )
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handle(
                                      () => promote.mutateAsync({ id: u.id }),
                                      "User promoted to admin",
                                    )
                                  }
                                  data-testid={`btn-promote-${u.id}`}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Make admin
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
