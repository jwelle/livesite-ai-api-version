import { useState } from "react";
import { useLocation } from "wouter";
import type { GetAdminUsersStatus } from "@workspace/api-client-react";
import {
  useGetAdminUsers,
  useSuspendUser,
  useReactivateUser,
  useApproveUser,
  useRejectUser,
  useSetUserRole,
  useSetUserTier,
  useManualCreateUser,
  useStartImpersonation,
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  getGetAdminUsersQueryKey,
  getListInvitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Eye,
  UserPlus,
  Check,
  X,
  Copy,
  Link as LinkIcon,
  Trash2,
  KeyRound,
} from "lucide-react";

const PAGE_SIZE = 25;

export default function AdminUsers() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users &amp; Access</h1>
        <p className="text-muted-foreground mt-1">
          Approve sign-ups, manage tiers, generate invite links, and add users manually.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="invites" data-testid="tab-invites">Invite Links</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="invites" className="mt-4">
          <InvitesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

function UsersPanel() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useGetAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    search,
    ...(statusFilter !== "all"
      ? { status: statusFilter as GetAdminUsersStatus }
      : {}),
  });
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });

  const suspend = useSuspendUser();
  const reactivate = useReactivateUser();
  const approve = useApproveUser();
  const reject = useRejectUser();
  const setRole = useSetUserRole();
  const setTier = useSetUserTier();
  const impersonate = useStartImpersonation();

  const handle = (action: () => Promise<unknown>, successMsg: string) => {
    action()
      .then(() => {
        toast({ title: successMsg });
        invalidate();
      })
      .catch((err: Error) => {
        toast({
          title: "Action failed",
          description: err.message,
          variant: "destructive",
        });
      });
  };

  const startImpersonate = (id: string) => {
    impersonate.mutate(
      { userId: id },
      {
        onSuccess: async () => {
          await refresh();
          window.location.href = "/dashboard";
        },
        onError: (err) => {
          toast({
            title: "Failed to start",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>All users ({total})</CardTitle>
          <CardDescription>
            Approve pending sign-ups, change tier or role, and impersonate any user.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setPage(1);
              setStatusFilter(v);
            }}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_approval">Pending approval</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
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
          <ManualAddUserDialog onAdded={invalidate} />
        </div>
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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Demos</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">Total enrich</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isPending = u.status === "pending_approval";
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
                        <Badge variant={u.tier === "pro" ? "default" : "outline"}>
                          {u.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.status === "active"
                              ? "default"
                              : u.status === "pending_approval"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {u.status === "pending_approval" ? "pending" : u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{u.demosCreated}</TableCell>
                      <TableCell className="text-right">{u.demosCreatedToday}</TableCell>
                      <TableCell className="text-right">{u.totalEnrichments}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.lastLoginAt
                          ? format(new Date(u.lastLoginAt), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 px-2"
                                onClick={() =>
                                  handle(
                                    () => approve.mutateAsync({ id: u.id }),
                                    "User approved",
                                  )
                                }
                                data-testid={`btn-approve-${u.id}`}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() =>
                                  confirm(`Reject ${u.email}?`) &&
                                  handle(
                                    () => reject.mutateAsync({ id: u.id }),
                                    "User rejected",
                                  )
                                }
                                data-testid={`btn-reject-${u.id}`}
                              >
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
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
                              {!isSelf && u.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => setLocation(`/admin/users/${u.id}/automation?email=${encodeURIComponent(u.email ?? "")}`)}
                                  data-testid={`btn-manage-automation-${u.id}`}
                                >
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Manage automation
                                </DropdownMenuItem>
                              )}
                              {!isSelf && u.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => startImpersonate(u.id)}
                                  data-testid={`btn-impersonate-${u.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View as user
                                </DropdownMenuItem>
                              )}
                              {u.tier === "free" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handle(
                                      () =>
                                        setTier.mutateAsync({
                                          id: u.id,
                                          data: { tier: "pro" },
                                        }),
                                      "Upgraded to Pro",
                                    )
                                  }
                                  data-testid={`btn-upgrade-${u.id}`}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Upgrade to Pro
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handle(
                                      () =>
                                        setTier.mutateAsync({
                                          id: u.id,
                                          data: { tier: "free" },
                                        }),
                                      "Downgraded to Free",
                                    )
                                  }
                                  data-testid={`btn-downgrade-${u.id}`}
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Downgrade to Free
                                </DropdownMenuItem>
                              )}
                              {u.role === "admin"
                                ? !isSelf && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handle(
                                          () =>
                                            setRole.mutateAsync({
                                              id: u.id,
                                              data: { role: "user" },
                                            }),
                                          "Admin removed",
                                        )
                                      }
                                      data-testid={`btn-demote-${u.id}`}
                                    >
                                      <ShieldOff className="mr-2 h-4 w-4" />
                                      Remove admin
                                    </DropdownMenuItem>
                                  )
                                : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handle(
                                        () =>
                                          setRole.mutateAsync({
                                            id: u.id,
                                            data: { role: "admin" },
                                          }),
                                        "User promoted to admin",
                                      )
                                    }
                                    data-testid={`btn-promote-${u.id}`}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Make admin
                                  </DropdownMenuItem>
                                )}
                              {u.status === "active" && !isSelf ? (
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
                              ) : u.status === "suspended" ? (
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
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
  );
}

// ---------------------------------------------------------------------------
// Manual add user
// ---------------------------------------------------------------------------

function ManualAddUserDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [role, setRole] = useState<"user" | "admin">("user");
  const create = useManualCreateUser();
  const { toast } = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { data: { email, tier, role } },
      {
        onSuccess: (res) => {
          toast({
            title: res.created ? "User created" : "User updated",
            description: res.user.email ?? "",
          });
          setOpen(false);
          setEmail("");
          setTier("free");
          setRole("user");
          onAdded();
        },
        onError: (err) => {
          toast({
            title: "Failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="btn-add-user">
          <UserPlus className="mr-2 h-4 w-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a user manually</DialogTitle>
            <DialogDescription>
              The user will be marked active immediately. They'll claim this account
              when they next sign in with this email through Replit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="manual-email">Email</Label>
            <Input
              id="manual-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              data-testid="input-manual-email"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as "free" | "pro")}>
                <SelectTrigger data-testid="select-manual-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
                <SelectTrigger data-testid="select-manual-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !email}
              data-testid="btn-submit-manual-user"
            >
              {create.isPending ? "Adding..." : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Invites tab
// ---------------------------------------------------------------------------

function InvitesPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListInvites({ page, pageSize: PAGE_SIZE });
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tier, setTier] = useState<"free" | "pro">("free");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListInvitesQueryKey() });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        data: {
          tier,
          invitedEmail: invitedEmail.trim() ? invitedEmail.trim() : null,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          note: null,
        },
      },
      {
        onSuccess: (res) => {
          const url = `${window.location.origin}/signup?invite=${res.invite.token}`;
          navigator.clipboard.writeText(url).catch(() => {});
          toast({
            title: "Invite created",
            description: "Invite link copied to clipboard.",
          });
          setInvitedEmail("");
          setExpiresInDays("");
          invalidate();
        },
        onError: (err) => {
          toast({
            title: "Failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast({ title: "Invite link copied" });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr,2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create invite link</CardTitle>
          <CardDescription>
            Share with someone to grant them access without admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as "free" | "pro")}>
                <SelectTrigger data-testid="select-invite-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Restrict to email (optional)</Label>
              <Input
                id="invite-email"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="user@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-expires">Expires in (days, optional)</Label>
              <Input
                id="invite-expires"
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="30"
                data-testid="input-invite-expires"
              />
            </div>
            <Button
              type="submit"
              disabled={create.isPending}
              data-testid="btn-create-invite"
              className="w-full"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              {create.isPending ? "Creating..." : "Create invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invites ({total})</CardTitle>
          <CardDescription>
            Track outstanding and used invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No invites yet.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>For email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((inv) => {
                    let statusLabel = "active";
                    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
                    if (inv.revokedAt) { statusLabel = "revoked"; variant = "destructive"; }
                    else if (inv.consumedAt) { statusLabel = "used"; variant = "secondary"; }
                    else if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
                      statusLabel = "expired"; variant = "destructive";
                    }
                    const usable = !inv.revokedAt && !inv.consumedAt &&
                      !(inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now());
                    return (
                      <TableRow key={inv.id} data-testid={`row-invite-${inv.id}`}>
                        <TableCell>
                          <Badge variant={inv.tier === "pro" ? "default" : "outline"}>
                            {inv.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.invitedEmail ?? "anyone"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant}>{statusLabel}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.expiresAt
                            ? format(new Date(inv.expiresAt), "MMM d, yyyy")
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(inv.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              disabled={!usable}
                              onClick={() => copyLink(inv.token)}
                              data-testid={`btn-copy-invite-${inv.id}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {usable && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive"
                                onClick={() =>
                                  confirm("Revoke this invite?") &&
                                  revoke.mutate(
                                    { id: inv.id },
                                    {
                                      onSuccess: () => {
                                        toast({ title: "Invite revoked" });
                                        invalidate();
                                      },
                                      onError: (err) =>
                                        toast({
                                          title: "Failed",
                                          description: (err as Error).message,
                                          variant: "destructive",
                                        }),
                                    },
                                  )
                                }
                                data-testid={`btn-revoke-invite-${inv.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
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
