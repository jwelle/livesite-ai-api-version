import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetAdminDemos, useStartImpersonation } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
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
import { format } from "date-fns";
import { ExternalLink, Eye } from "lucide-react";

export default function AdminDemos() {
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("ownerEmail") ?? "";
  });
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { refresh } = useAuth();
  const { toast } = useToast();
  const impersonate = useStartImpersonation();

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search).get("ownerEmail") ?? "";
      setSearch(q);
      setPage(1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const viewAsOwner = (userId: string, email: string | null) => {
    impersonate.mutate({ userId }, {
      onSuccess: async () => {
        await refresh();
        window.location.href = "/dashboard";
      },
      onError: (err) => {
        toast({
          title: `Failed to view as ${email ?? "owner"}`,
          description: (err as Error).message,
          variant: "destructive",
        });
      },
    });
  };

  const { data, isLoading } = useGetAdminDemos({ page, pageSize, search });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All Demos</h1>
        <p className="text-muted-foreground mt-1">
          Every demo created across all customers.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>All demos ({total})</CardTitle>
          <Input
            placeholder="Search company, slug, owner..."
            className="max-w-sm"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            data-testid="input-search-demos"
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
              No demos found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Calendar</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((d) => (
                    <TableRow key={d.id} data-testid={`row-admin-demo-${d.id}`}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/demos/${d.id}`}
                          className="hover:underline"
                        >
                          {d.companyName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{d.slug}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            setPage(1);
                            setSearch(d.ownerEmail ?? "");
                          }}
                          data-testid={`btn-filter-owner-${d.id}`}
                        >
                          {d.ownerEmail ?? d.userId}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.status === "active" ? "default" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{d.viewCount}</TableCell>
                      <TableCell className="text-right">{d.callClickCount}</TableCell>
                      <TableCell className="text-right">{d.calendarClickCount}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(d.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewAsOwner(d.userId, d.ownerEmail ?? null)}
                            disabled={impersonate.isPending}
                            data-testid={`btn-view-as-owner-${d.id}`}
                            title="View as owner"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/demo/${d.slug}`, "_blank")}
                            data-testid={`btn-open-demo-${d.id}`}
                            title="Open public demo"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
