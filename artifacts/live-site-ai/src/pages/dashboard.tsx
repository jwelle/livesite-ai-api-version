import { useGetDemos, useGetDashboardStats, getGetDemosQueryKey, useDeleteDemo } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Globe, Phone, Calendar, Plus, Eye, Edit, Trash2, Link as LinkIcon, MoreHorizontal, ExternalLink, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useGetDashboardStats();
  const { data: demos, isLoading: isLoadingDemos } = useGetDemos();
  const deleteDemo = useDeleteDemo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { impersonating } = useAuth();

  const handleDelete = (id: string) => {
    if (impersonating) {
      toast({ title: "Blocked", description: "Mutating actions are blocked while viewing as another user.", variant: "destructive" });
      return;
    }
    if (confirm("Are you sure you want to delete this demo?")) {
      deleteDemo.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Demo deleted successfully" });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to delete demo", variant: "destructive" });
        }
      });
    }
  };

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/demo/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your AI demos and engagement metrics.</p>
        </div>
        <Link href="/demos/new">
          <Button data-testid="btn-create-demo-header">
            <Plus className="mr-2 h-4 w-4" />
            Create Demo
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
        <MetricCard title="Total Demos" value={stats?.totalDemos} icon={<Globe className="h-4 w-4 text-muted-foreground" />} isLoading={isLoadingStats} />
        <MetricCard title="Active Demos" value={stats?.activeDemos} icon={<Globe className="h-4 w-4 text-primary" />} isLoading={isLoadingStats} />
        <MetricCard title="Total Views" value={stats?.totalViews} icon={<Eye className="h-4 w-4 text-muted-foreground" />} isLoading={isLoadingStats} />
        <MetricCard title="Call Clicks" value={stats?.totalCallClicks} icon={<Phone className="h-4 w-4 text-secondary" />} isLoading={isLoadingStats} />
        <MetricCard title="Calendar Clicks" value={stats?.totalCalendarClicks} icon={<Calendar className="h-4 w-4 text-yellow-500" />} isLoading={isLoadingStats} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Demos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDemos ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : demos?.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No demos yet</h3>
              <p className="text-muted-foreground mb-4 mt-1">Create your first AI demo to get started.</p>
              <Link href="/demos/new">
                <Button variant="outline" data-testid="btn-create-demo-empty">Create Demo</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demos?.map((demo) => (
                    <TableRow key={demo.id} data-testid={`row-demo-${demo.id}`}>
                      <TableCell className="font-medium">{demo.companyName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        <a href={demo.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">{demo.websiteUrl}</a>
                      </TableCell>
                      <TableCell>{demo.industry || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(demo.status)}>{demo.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{demo.viewCount}</TableCell>
                      <TableCell className="text-right">{demo.callClickCount}</TableCell>
                      <TableCell>{format(new Date(demo.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 gap-1.5"
                            onClick={() => copyToClipboard(demo.slug)}
                            data-testid={`btn-copy-url-${demo.id}`}
                            title="Copy demo URL"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-xs">Copy URL</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 gap-1.5 text-primary hover:text-primary"
                            onClick={() => window.open(`/demo/${demo.slug}`, "_blank")}
                            data-testid={`btn-launch-${demo.id}`}
                            title="Launch demo in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-xs">Launch</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`btn-demo-actions-${demo.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/demos/${demo.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View Details</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/demos/${demo.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(demo.slug)}>
                              <LinkIcon className="mr-2 h-4 w-4" />
                              <span>Copy Link</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={`btn-copy-prompt-${demo.id}`}
                              disabled={!(demo.currentWorkingPrompt || demo.aiGeneratedPrompt)}
                              onClick={() => {
                                const prompt = demo.currentWorkingPrompt || demo.aiGeneratedPrompt || "";
                                if (!prompt) {
                                  toast({ title: "No prompt yet", description: "Run AI enrichment first.", variant: "destructive" });
                                  return;
                                }
                                navigator.clipboard.writeText(prompt);
                                toast({ title: "Prompt copied to clipboard" });
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Prompt</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(demo.id)}
                              disabled={!!impersonating}
                              className="text-destructive focus:text-destructive"
                              title={impersonating ? "Disabled while viewing as another user" : undefined}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
    case "approved":
    case "pushed_to_ghl":
      return "default";
    case "enriched":
    case "edited":
    case "copied":
      return "secondary";
    case "inactive":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function MetricCard({ title, value, icon, isLoading }: { title: string, value?: number, icon: React.ReactNode, isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
