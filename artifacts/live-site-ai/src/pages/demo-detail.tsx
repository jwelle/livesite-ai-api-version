import {
  useGetDemo,
  useDeleteDemo,
  useRegenerateDemoSlug,
  useAnalyzeDemoWebsite,
  useApplyDemoWebsiteIntelligence,
  getGetDemoQueryKey,
  getGetDemosQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Phone,
  Calendar,
  Bot,
  Globe,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

const APPLY_FIELDS: Array<{ key: string; label: string; description: string; sourceKey: keyof DemoSourceMap }> = [
  { key: "companyDescription", label: "Company Description", description: "Use the extracted business summary.", sourceKey: "extractedBusinessSummary" },
  { key: "servicesOffered", label: "Services Offered", description: "Use the extracted services list.", sourceKey: "extractedServices" },
  { key: "serviceArea", label: "Service Area", description: "Use the extracted service area.", sourceKey: "extractedServiceArea" },
  { key: "chatPersonaName", label: "Chat Persona Name", description: "Use the suggested chat persona.", sourceKey: "suggestedChatPersona" },
  { key: "voicePersonaName", label: "Voice Persona Name", description: "Use the suggested voice persona.", sourceKey: "suggestedVoicePersona" },
  { key: "voiceAiGoal", label: "Voice AI Goal / Prompt", description: "Use the generated Voice AI prompt.", sourceKey: "generatedVoicePrompt" },
];

type DemoSourceMap = {
  extractedBusinessSummary: string | null | undefined;
  extractedServices: string[] | null | undefined;
  extractedServiceArea: string | null | undefined;
  suggestedChatPersona: string | null | undefined;
  suggestedVoicePersona: string | null | undefined;
  generatedVoicePrompt: string | null | undefined;
};

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
  const analyzeWebsite = useAnalyzeDemoWebsite();
  const applyIntelligence = useApplyDemoWebsiteIntelligence();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

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

  const fallbackPrompt = `Act as ${demo.voicePersonaName || "an AI Assistant"} representing ${demo.companyName}.
${demo.companyDescription ? `\nAbout us: ${demo.companyDescription}` : ""}
${demo.servicesOffered ? `\nOur services: ${demo.servicesOffered}` : ""}
${demo.serviceArea ? `\nService area: ${demo.serviceArea}` : ""}
${demo.customDemoMessage ? `\nImportant info: ${demo.customDemoMessage}` : ""}
${demo.voiceAiGoal ? `\nGoal: ${demo.voiceAiGoal}` : ""}

Be professional, concise, and helpful.`;
  const generatedPrompt = demo.generatedVoicePrompt || fallbackPrompt;

  const handleAnalyze = () => {
    analyzeWebsite.mutate(
      { id: demo.id, data: {} },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(demo.id) });
          const sourceLabel = data.source === "openai" ? "OpenAI" : "basic parser";
          toast({
            title: `Website analyzed (${sourceLabel})`,
            description: data.warnings.length > 0 ? data.warnings[0] : undefined,
          });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.message || "Failed to analyze website";
          toast({ title: "Website analysis failed", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const sourceData: DemoSourceMap = {
    extractedBusinessSummary: demo.extractedBusinessSummary,
    extractedServices: (demo.extractedServices as string[] | null) ?? null,
    extractedServiceArea: demo.extractedServiceArea,
    suggestedChatPersona: demo.suggestedChatPersona,
    suggestedVoicePersona: demo.suggestedVoicePersona,
    generatedVoicePrompt: demo.generatedVoicePrompt,
  };

  const fieldHasValue = (sourceKey: keyof DemoSourceMap): boolean => {
    const v = sourceData[sourceKey];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0 && v !== "Unknown";
    return false;
  };

  const toggleField = (key: string, checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleApply = () => {
    if (selectedFields.size === 0) {
      toast({ title: "Select at least one field to apply" });
      return;
    }
    applyIntelligence.mutate(
      { id: demo.id, data: { fields: Array.from(selectedFields) as any } },
      {
        onSuccess: () => {
          toast({ title: "Applied to demo fields" });
          setSelectedFields(new Set());
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(demo.id) });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to apply",
            description: err?.message || "",
            variant: "destructive",
          });
        },
      },
    );
  };

  const analyzedAt = demo.websiteAnalyzedAt ? new Date(demo.websiteAnalyzedAt) : null;
  const services = (demo.extractedServices as string[] | null) ?? null;
  const headings = (demo.websiteHeadings as string[] | null) ?? null;
  const leadQuestions = (demo.suggestedLeadQuestions as string[] | null) ?? null;
  const faqs = (demo.extractedFaqs as Array<{ question: string; answer_guidance: string }> | null) ?? null;
  const missing = (demo.missingInformation as string[] | null) ?? null;

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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Website Intelligence
                  </CardTitle>
                  <CardDescription>
                    Fetch the prospect's website and auto-generate a Voice AI prompt and chat context.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeWebsite.isPending}
                  data-testid="btn-analyze-website"
                >
                  {analyzeWebsite.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {demo.websiteAnalyzedAt ? "Re-analyze Website" : "Analyze Website"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {demo.websiteAnalysisStatus === "failed" && demo.websiteAnalysisError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Analysis failed</AlertTitle>
                  <AlertDescription>{demo.websiteAnalysisError}</AlertDescription>
                </Alert>
              )}

              {!demo.websiteAnalyzedAt && demo.websiteAnalysisStatus !== "failed" && (
                <p className="text-sm text-muted-foreground">
                  Click "Analyze Website" to pull content from{" "}
                  <span className="font-medium">{demo.websiteUrl}</span> and generate suggestions.
                </p>
              )}

              {demo.websiteAnalyzedAt && (
                <>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>
                      Analyzed {analyzedAt ? format(analyzedAt, "PPpp") : ""}
                      {demo.websiteAnalysisSource ? ` · ${demo.websiteAnalysisSource}` : ""}
                    </span>
                  </div>

                  {missing && missing.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Items to confirm manually</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {missing.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-5 sm:grid-cols-2">
                    {demo.extractedBusinessSummary && (
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Business Summary</div>
                        <div className="text-sm" data-testid="text-business-summary">{demo.extractedBusinessSummary}</div>
                      </div>
                    )}
                    {services && services.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Likely Services</div>
                        <div className="flex flex-wrap gap-1">
                          {services.map((s, i) => (
                            <Badge key={i} variant="secondary">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {demo.extractedServiceArea && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Service Area</div>
                        <div className="text-sm">{demo.extractedServiceArea}</div>
                      </div>
                    )}
                    {demo.extractedTone && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Tone</div>
                        <div className="text-sm">{demo.extractedTone}</div>
                      </div>
                    )}
                    {demo.extractedTargetCustomers && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Target Customers</div>
                        <div className="text-sm">{demo.extractedTargetCustomers}</div>
                      </div>
                    )}
                    {demo.suggestedChatPersona && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suggested Chat Persona</div>
                        <div className="text-sm">{demo.suggestedChatPersona}</div>
                      </div>
                    )}
                    {demo.suggestedVoicePersona && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suggested Voice Persona</div>
                        <div className="text-sm">{demo.suggestedVoicePersona}</div>
                      </div>
                    )}
                  </div>

                  {leadQuestions && leadQuestions.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Lead Qualification Questions</div>
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {leadQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ol>
                    </div>
                  )}

                  {faqs && faqs.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">FAQ Guidance</div>
                      <ul className="space-y-2 text-sm">
                        {faqs.map((f, i) => (
                          <li key={i} className="border-l-2 border-muted pl-3">
                            <div className="font-medium">{f.question}</div>
                            <div className="text-muted-foreground">{f.answer_guidance}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {headings && headings.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Show {headings.length} extracted page headings
                      </summary>
                      <ul className="list-disc pl-5 mt-2 space-y-0.5 text-muted-foreground">
                        {headings.map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </details>
                  )}

                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <div className="font-medium">Apply to demo fields</div>
                      <div className="text-xs text-muted-foreground">
                        Pick which generated values to copy into your editable demo fields. This will overwrite the selected fields.
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {APPLY_FIELDS.map((f) => {
                        const enabled = fieldHasValue(f.sourceKey);
                        return (
                          <label
                            key={f.key}
                            className={`flex items-start gap-2 rounded-md border p-2 ${enabled ? "" : "opacity-50"}`}
                          >
                            <Checkbox
                              disabled={!enabled}
                              checked={selectedFields.has(f.key)}
                              onCheckedChange={(c) => toggleField(f.key, Boolean(c))}
                              data-testid={`checkbox-apply-${f.key}`}
                            />
                            <div className="text-sm">
                              <div className="font-medium">{f.label}</div>
                              <div className="text-xs text-muted-foreground">{f.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleApply}
                      disabled={applyIntelligence.isPending || selectedFields.size === 0}
                      data-testid="btn-apply-intel"
                    >
                      {applyIntelligence.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Apply selected ({selectedFields.size})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generated Voice AI Prompt</CardTitle>
              <CardDescription>
                {demo.generatedVoicePrompt
                  ? "Generated from your website analysis. Copy this into your GHL Voice AI prompt field."
                  : "Run the website analysis above to generate a richer prompt. Showing a basic template for now."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-auto">
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
              {demo.generatedChatContext && (
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">Chat Context</div>
                  <pre className="p-4 rounded-lg bg-muted font-mono text-xs whitespace-pre-wrap text-muted-foreground max-h-72 overflow-auto">
                    {demo.generatedChatContext}
                  </pre>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(demo.generatedChatContext!);
                      toast({ title: "Chat context copied" });
                    }}
                    data-testid="btn-copy-chat-context"
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copy Chat Context
                  </Button>
                </div>
              )}
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
