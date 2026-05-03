import {
  useGetDemo,
  useDeleteDemo,
  useRegenerateDemoSlug,
  useEnrichDemo,
  useRegenerateDemoPrompt,
  useUpdateDemo,
  useLogDemoCopyEvent,
  usePushDemoToGhl,
  useGetOpenAIStatus,
  getGetDemoQueryKey,
  getGetDemosQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, ExternalLink, Copy, Edit, Trash2, RefreshCw, Eye, Phone, Calendar, Bot, Globe, Loader2, Sparkles, Save, Send, FileJson, FileText, RotateCcw, AlertTriangle } from "lucide-react";
import { getExportDemoMarkdownUrl, getExportDemoJsonUrl } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { useAuth } from "@workspace/replit-auth-web";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  approved: "default",
  pushed_to_ghl: "default",
  enriched: "secondary",
  edited: "secondary",
  copied: "secondary",
  draft: "outline",
  inactive: "destructive",
  failed: "destructive",
};

export default function DemoDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { impersonating } = useAuth();
  const [workingPrompt, setWorkingPrompt] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);

  const { data: demo, isLoading } = useGetDemo(id as string, {
    query: { enabled: !!id, queryKey: getGetDemoQueryKey(id as string) }
  });
  const { data: openaiStatus } = useGetOpenAIStatus();

  const deleteDemo = useDeleteDemo();
  const regenerateSlug = useRegenerateDemoSlug();
  const enrichDemo = useEnrichDemo();
  const regeneratePrompt = useRegenerateDemoPrompt();
  const updateDemo = useUpdateDemo();
  const logCopy = useLogDemoCopyEvent();
  const pushGhl = usePushDemoToGhl();

  useEffect(() => {
    if (demo) {
      setWorkingPrompt(demo.currentWorkingPrompt || demo.aiGeneratedPrompt || "");
      setDirty(false);
    }
  }, [demo?.currentWorkingPrompt, demo?.aiGeneratedPrompt, demo?.id]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;
  }
  if (!demo) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Demo not found</div>;
  }

  const aiConfigured = openaiStatus?.configured ?? false;
  const hasPrompt = !!(demo.aiGeneratedPrompt || demo.currentWorkingPrompt);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(demo.id) });
    queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this demo?")) {
      deleteDemo.mutate({ id: demo.id }, {
        onSuccess: () => { toast({ title: "Demo deleted" }); invalidate(); setLocation("/dashboard"); },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      });
    }
  };

  const handleRegenerateSlug = () => {
    if (confirm("This will break existing links. Continue?")) {
      regenerateSlug.mutate({ id: demo.id }, {
        onSuccess: () => { toast({ title: "Link regenerated" }); invalidate(); }
      });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/demo/${demo.slug}`);
    toast({ title: "Copied to clipboard" });
  };

  const handleEnrich = () => {
    enrichDemo.mutate({ id: demo.id }, {
      onSuccess: () => { toast({ title: "Enrichment complete" }); invalidate(); },
      onError: () => toast({ title: "Enrichment failed", variant: "destructive" }),
    });
  };

  // Replace the working prompt with the freshly regenerated AI prompt.
  const regenerateAndReplace = () => {
    regeneratePrompt.mutate({ id: demo.id }, {
      onSuccess: (updated) => {
        const next = (updated && (updated as { aiGeneratedPrompt?: string }).aiGeneratedPrompt) || "";
        if (next) {
          updateDemo.mutate({ id: demo.id, data: { currentWorkingPrompt: next, status: "edited" } }, {
            onSuccess: () => { toast({ title: "Prompt regenerated and replaced" }); invalidate(); },
            onError: () => { toast({ title: "Regenerated but failed to replace working prompt", variant: "destructive" }); invalidate(); },
          });
        } else {
          toast({ title: "Prompt regenerated" });
          invalidate();
        }
      },
      onError: () => toast({ title: "Regenerate failed", variant: "destructive" }),
    });
  };

  // Generate a new AI prompt and save it as a separate version, leaving the
  // user's working prompt untouched.
  const regenerateSeparately = () => {
    regeneratePrompt.mutate({ id: demo.id }, {
      onSuccess: () => {
        toast({ title: "New AI prompt saved as a separate version", description: "Your working prompt was preserved." });
        invalidate();
      },
      onError: () => toast({ title: "Regenerate failed", variant: "destructive" }),
    });
  };

  const handleRegeneratePrompt = () => {
    setRegenDialogOpen(true);
  };

  const handleSavePrompt = () => {
    updateDemo.mutate({ id: demo.id, data: { currentWorkingPrompt: workingPrompt, status: "edited" } }, {
      onSuccess: () => { toast({ title: "Prompt saved" }); invalidate(); setDirty(false); },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  const handleApprove = () => {
    updateDemo.mutate({ id: demo.id, data: { finalSavedPrompt: workingPrompt, currentWorkingPrompt: workingPrompt, status: "approved" } }, {
      onSuccess: () => { toast({ title: "Marked as Final" }); invalidate(); setDirty(false); },
      onError: () => toast({ title: "Approve failed", variant: "destructive" }),
    });
  };

  const handleResetToAI = () => {
    if (!demo.aiGeneratedPrompt) return;
    if (!confirm("Reset working prompt to the AI-generated version? Your edits will be lost.")) return;
    setWorkingPrompt(demo.aiGeneratedPrompt);
    setDirty(true);
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(workingPrompt);
    toast({ title: "Prompt copied" });
    logCopy.mutate({ id: demo.id }, { onSuccess: () => invalidate() });
  };

  const handleExportMd = async () => {
    try {
      const res = await fetch(getExportDemoMarkdownUrl(demo.id), { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${demo.slug}-prompt.md`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Export failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await fetch(getExportDemoJsonUrl(demo.id), { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${demo.slug}-export.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Export failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handlePushGhl = () => {
    pushGhl.mutate({ id: demo.id }, {
      onSuccess: (res) => {
        toast({ title: res.success ? "Pushed to GHL" : "GHL push not configured", description: res.message ?? undefined });
      }
    });
  };

  const publicUrl = `${window.location.origin}/demo/${demo.slug}`;
  const profile = demo.businessProfile as { businessName?: string; industry?: string; summary?: string; services?: string[]; serviceArea?: string; phone?: string; hours?: string; differentiators?: string[]; customerTypes?: string[]; commonQuestions?: string[]; sourceNotes?: { title?: string; url?: string; note?: string }[]; unknowns?: string[] } | null;
  const limitedInfo = !!profile && (
    !profile.sourceNotes || profile.sourceNotes.length === 0 ||
    ((profile.summary === "unknown" || !profile.summary) && (!profile.services || profile.services.length === 0))
  );
  const pkg = demo.voiceAgentPackage as { agentName?: string; agentRole?: string; tone?: string; openingScript?: string; qualificationQuestions?: string[]; objectionHandlers?: { objection?: string; response?: string }[]; escalationRules?: string[]; bookingInstructions?: string; complianceBoundaries?: string[] } | null;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" data-testid="btn-back"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{demo.companyName}</h1>
              <Badge variant={STATUS_VARIANT[demo.status] || "secondary"} data-testid="badge-status">{demo.status}</Badge>
            </div>
            <a href={demo.websiteUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center mt-1">
              <Globe className="h-4 w-4 mr-1" /> {demo.websiteUrl}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyLink} data-testid="btn-copy-link"><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="default" data-testid="btn-open-demo"><ExternalLink className="mr-2 h-4 w-4" /> Open Public Demo</Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Views</CardTitle><Eye className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{demo.viewCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Call Clicks</CardTitle><Phone className="h-4 w-4 text-secondary" /></CardHeader><CardContent><div className="text-2xl font-bold">{demo.callClickCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Calendar Clicks</CardTitle><Calendar className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{demo.calendarClickCount}</div></CardContent></Card>
      </div>

      {!hasPrompt && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>No AI prompt yet</AlertTitle>
          <AlertDescription className="mt-2 flex items-center gap-3">
            <span>Run AI enrichment to research this business and generate a voice agent prompt.</span>
            <Button size="sm" onClick={handleEnrich} disabled={!aiConfigured || enrichDemo.isPending || !!impersonating || !demo.voiceAiGoal} data-testid="btn-enrich-demo">
              {enrichDemo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Enrich with AI
            </Button>
            {!demo.voiceAiGoal && <span className="text-xs text-destructive">Set Voice Agent Goal first.</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          <Tabs defaultValue="prompt">
            <TabsList>
              <TabsTrigger value="prompt" data-testid="tab-prompt">Voice Agent Prompt</TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile">Business Profile</TabsTrigger>
              <TabsTrigger value="package" data-testid="tab-package">Agent Package</TabsTrigger>
              <TabsTrigger value="config" data-testid="tab-config">Demo Config</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Agent Prompt</CardTitle>
                  <CardDescription>Edit freely. Saving updates your working prompt without overwriting the AI-generated version.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="default" className="border-yellow-500/50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle>Review before going live</AlertTitle>
                    <AlertDescription>
                      AI-generated business information should be reviewed before using it in a live voice agent. Do not rely on AI-generated pricing, availability, legal claims, medical claims, financial claims, financial advice, guarantees, licenses, or credentials unless confirmed by the business.
                    </AlertDescription>
                  </Alert>
                  {limitedInfo && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Limited public information</AlertTitle>
                      <AlertDescription>
                        Limited public information was found. Please review the generated prompt carefully and add missing details before using it.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Textarea
                    value={workingPrompt}
                    onChange={(e) => { setWorkingPrompt(e.target.value); setDirty(true); }}
                    rows={24}
                    className="font-mono text-sm"
                    placeholder="Run AI enrichment to generate a prompt, or write your own here."
                    data-testid="input-prompt"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSavePrompt} disabled={!dirty || updateDemo.isPending || !!impersonating} data-testid="btn-save-prompt">
                      {updateDemo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Working Prompt
                    </Button>
                    <Button variant="outline" onClick={handleApprove} disabled={!workingPrompt || updateDemo.isPending || !!impersonating} data-testid="btn-approve-prompt">
                      Mark as Final
                    </Button>
                    <Button variant="outline" onClick={handleCopyPrompt} disabled={!workingPrompt} data-testid="btn-copy-prompt">
                      <Copy className="mr-2 h-4 w-4" /> Copy Prompt
                    </Button>
                    <Button variant="outline" onClick={handleRegeneratePrompt} disabled={!aiConfigured || regeneratePrompt.isPending || !!impersonating || !demo.voiceAiGoal} data-testid="btn-regen-prompt">
                      {regeneratePrompt.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Regenerate AI Prompt
                    </Button>
                    <Button variant="outline" onClick={handleResetToAI} disabled={!demo.aiGeneratedPrompt} data-testid="btn-reset-prompt">
                      <RotateCcw className="mr-2 h-4 w-4" /> Reset to AI
                    </Button>
                    <Button variant="outline" onClick={handleEnrich} disabled={!aiConfigured || enrichDemo.isPending || !!impersonating || !demo.voiceAiGoal} data-testid="btn-enrich-demo-2">
                      <Sparkles className="mr-2 h-4 w-4" /> Re-Enrich
                    </Button>
                  </div>
                  {demo.finalSavedPrompt && (
                    <p className="text-xs text-muted-foreground">Final prompt saved {demo.updatedAt ? format(new Date(demo.updatedAt), "PPp") : ""}.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Business Profile</CardTitle><CardDescription>Grounded in public web search.</CardDescription></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!profile && <p className="text-muted-foreground">No profile yet. Run AI enrichment.</p>}
                  {profile && (
                    <>
                      <Field label="Industry" value={profile.industry} />
                      <Field label="Summary" value={profile.summary} />
                      <ListField label="Services" items={profile.services} />
                      <Field label="Service Area" value={profile.serviceArea} />
                      <Field label="Phone" value={profile.phone} />
                      <Field label="Hours" value={profile.hours} />
                      <ListField label="Differentiators" items={profile.differentiators} />
                      <ListField label="Customer Types" items={profile.customerTypes} />
                      <ListField label="Common Questions" items={profile.commonQuestions} />
                      <ListField label="Unknowns" items={profile.unknowns} />
                      {profile.sourceNotes && profile.sourceNotes.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Sources</div>
                          <ul className="space-y-1">
                            {profile.sourceNotes.map((s, i) => (
                              <li key={i}>
                                {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-primary underline">{s.title || s.url}</a> : <span>{s.title}</span>}
                                {s.note ? <span className="text-muted-foreground"> — {s.note}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="package" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Voice Agent Package</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!pkg && <p className="text-muted-foreground">No package yet. Run AI enrichment.</p>}
                  {pkg && (
                    <>
                      <Field label="Agent Name" value={pkg.agentName} />
                      <Field label="Agent Role" value={pkg.agentRole} />
                      <Field label="Tone" value={pkg.tone} />
                      <Field label="Opening Script" value={pkg.openingScript} />
                      <ListField label="Qualification Questions" items={pkg.qualificationQuestions} />
                      <ListField label="Escalation Rules" items={pkg.escalationRules} />
                      <ListField label="Compliance Boundaries" items={pkg.complianceBoundaries} />
                      <Field label="Booking Instructions" value={pkg.bookingInstructions} />
                      {pkg.objectionHandlers && pkg.objectionHandlers.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Objection Handlers</div>
                          <ul className="space-y-2">
                            {pkg.objectionHandlers.map((o, i) => (
                              <li key={i}><span className="font-medium">{o.objection}</span> → {o.response}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Demo Configuration</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-4">
                  <Info label="Industry" value={demo.industry} />
                  <Info label="Voice AI Phone" value={demo.voiceAiPhoneNumber} />
                  <Info label="Voice Persona" value={demo.voicePersonaName} />
                  <Info label="Voice Agent Goal" value={demo.voiceAiGoal} />
                  <Info label="Desired Tone" value={demo.desiredTone} />
                  <Info label="Primary CTA" value={demo.primaryCta} />
                  <Info label="Chat Widget ID" value={demo.chatWidgetId} mono />
                  <Info label="Chat Persona" value={demo.chatPersonaName} />
                  <Info label="Calendar Link" value={demo.ctaCalendarLink} className="sm:col-span-2" />
                  <Info label="Created" value={demo.createdAt ? format(new Date(demo.createdAt), "PPpp") : null} className="sm:col-span-2" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/demos/${demo.id}/edit`}>
                <Button className="w-full justify-start" variant="outline" data-testid="btn-edit-demo"><Edit className="mr-2 h-4 w-4" /> Edit Details</Button>
              </Link>
              <Button className="w-full justify-start" variant="outline" onClick={handleExportMd} disabled={!hasPrompt} data-testid="btn-export-md">
                <FileText className="mr-2 h-4 w-4" /> Export Prompt (.md)
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handleExportJson} data-testid="btn-export-json">
                <FileJson className="mr-2 h-4 w-4" /> Export Full (.json)
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handlePushGhl} disabled={pushGhl.isPending || !!impersonating} data-testid="btn-push-ghl">
                {pushGhl.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Push to GHL
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handleRegenerateSlug} disabled={regenerateSlug.isPending || !!impersonating} data-testid="btn-regen-slug">
                {regenerateSlug.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate Link Slug
              </Button>
              <Button className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-transparent" variant="outline" onClick={handleDelete} disabled={deleteDemo.isPending || !!impersonating} data-testid="btn-delete-demo">
                {deleteDemo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Demo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Widget Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Active Persona</div>
                  <div className="font-semibold text-primary">{demo.chatPersonaName || "AI Assistant"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Resolved Widget ID</div>
                  <div className="font-mono text-xs p-2 bg-muted rounded truncate">{demo.chatWidgetId || "Using agency default"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate AI prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              A new AI prompt will be generated. Choose what to do with your current working prompt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Button
              variant="default"
              data-testid="btn-regen-replace"
              onClick={() => { setRegenDialogOpen(false); regenerateAndReplace(); }}
            >
              Replace current working prompt
            </Button>
            <Button
              variant="outline"
              data-testid="btn-regen-separate"
              onClick={() => { setRegenDialogOpen(false); regenerateSeparately(); }}
            >
              Save new version separately (keep my edits)
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-regen-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <span style={{ display: "none" }} />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap">{value}</div>
    </div>
  );
}
function ListField({ label, items }: { label: string; items?: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{label}</div>
      <ul className="list-disc pl-5 space-y-0.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}
function Info({ label, value, mono, className }: { label: string; value?: string | null; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`font-medium ${mono ? "font-mono text-sm" : ""}`}>{value || "—"}</div>
    </div>
  );
}
