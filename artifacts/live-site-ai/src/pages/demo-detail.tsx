import { useGetDemo, useDeleteDemo, useRegenerateDemoSlug, getGetDemoQueryKey, getGetDemosQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Copy, Edit, Trash2, RefreshCw, Eye, Phone, Calendar, Bot, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";

export default function DemoDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demo, isLoading } = useGetDemo(id as string, {
    query: {
      enabled: !!id,
      queryKey: getGetDemoQueryKey(id as string)
    }
  });

  const deleteDemo = useDeleteDemo();
  const regenerateSlug = useRegenerateDemoSlug();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  if (!demo) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Demo not found</div>;
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this demo?")) {
      deleteDemo.mutate({ id: demo.id }, {
        onSuccess: () => {
          toast({ title: "Demo deleted" });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
          setLocation("/dashboard");
        },
        onError: () => {
          toast({ title: "Failed to delete", variant: "destructive" });
        }
      });
    }
  };

  const handleRegenerateSlug = () => {
    if (confirm("This will break existing links. Continue?")) {
      regenerateSlug.mutate({ id: demo.id }, {
        onSuccess: (updated) => {
          toast({ title: "Link regenerated" });
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(demo.id) });
        }
      });
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/demo/${demo.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  const publicUrl = `${window.location.origin}/demo/${demo.slug}`;

  // Generate a mock prompt based on data
  const generatedPrompt = `Act as ${demo.voicePersonaName || "an AI Assistant"} representing ${demo.companyName}.
${demo.companyDescription ? `\nAbout us: ${demo.companyDescription}` : ""}
${demo.servicesOffered ? `\nOur services: ${demo.servicesOffered}` : ""}
${demo.serviceArea ? `\nService area: ${demo.serviceArea}` : ""}
${demo.customDemoMessage ? `\nImportant info: ${demo.customDemoMessage}` : ""}
${demo.voiceAiGoal ? `\nGoal: ${demo.voiceAiGoal}` : ""}

Be professional, concise, and helpful.`;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{demo.companyName}</h1>
              <Badge variant={demo.status === "active" ? "default" : demo.status === "draft" ? "secondary" : "destructive"}>
                {demo.status}
              </Badge>
            </div>
            <a href={demo.websiteUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center mt-1">
              <Globe className="h-4 w-4 mr-1" />
              {demo.websiteUrl}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyLink} data-testid="btn-copy-link">
            <Copy className="mr-2 h-4 w-4" /> Copy Link
          </Button>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="btn-open-demo">
              <ExternalLink className="mr-2 h-4 w-4" /> Open Public Demo
            </Button>
          </a>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demo.viewCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Call Clicks</CardTitle>
            <Phone className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demo.callClickCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calendar Clicks</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demo.calendarClickCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Demo Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Industry</div>
                <div className="font-medium">{demo.industry || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Contact</div>
                <div className="font-medium">{demo.contactName || "—"} {demo.contactEmail ? `(${demo.contactEmail})` : ""}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Voice AI Phone</div>
                <div className="font-medium">{demo.voiceAiPhoneNumber || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Voice Persona</div>
                <div className="font-medium">{demo.voicePersonaName || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Chat Widget ID</div>
                <div className="font-medium font-mono text-sm">{demo.chatWidgetId || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Chat Persona</div>
                <div className="font-medium">{demo.chatPersonaName || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-muted-foreground mb-1">Calendar Link</div>
                <div className="font-medium text-blue-400 break-all">{demo.ctaCalendarLink || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-muted-foreground mb-1">Created At</div>
                <div className="font-medium">{format(new Date(demo.createdAt), "PPpp")}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generated Voice AI Prompt</CardTitle>
              <CardDescription>Copy this into your GHL Voice AI prompt field.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted font-mono text-sm whitespace-pre-wrap text-muted-foreground">
                {generatedPrompt}
              </pre>
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  toast({ title: "Prompt copied" });
                }}
                data-testid="btn-copy-prompt"
              >
                <Copy className="mr-2 h-4 w-4" /> Copy Prompt
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/demos/${demo.id}/edit`}>
                <Button className="w-full justify-start" variant="outline" data-testid="btn-edit-demo">
                  <Edit className="mr-2 h-4 w-4" /> Edit Details
                </Button>
              </Link>
              <Button className="w-full justify-start" variant="outline" onClick={handleRegenerateSlug} disabled={regenerateSlug.isPending} data-testid="btn-regen-slug">
                {regenerateSlug.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate Link Slug
              </Button>
              <Button className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-transparent" variant="outline" onClick={handleDelete} disabled={deleteDemo.isPending} data-testid="btn-delete-demo">
                {deleteDemo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Demo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Widget Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Active Persona</div>
                  <div className="font-semibold text-primary">{demo.chatPersonaName || "AI Assistant"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Resolved Widget ID</div>
                  <div className="font-mono text-xs p-2 bg-muted rounded truncate">
                    {demo.chatWidgetId || "Using agency default"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
