import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateDemo,
  useUpdateDemo,
  useGetDemo,
  useEnrichBusiness,
  useGetOpenAIStatus,
  getGetDemoQueryKey,
  getGetDemosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Save, Sparkles, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  websiteUrl: z.string().min(1, "Website URL is required"),
  industry: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  voiceAiPhoneNumber: z.string().optional(),
  voicePersonaName: z.string().optional(),
  voiceAiGoal: z.string().optional(),
  desiredTone: z.string().optional(),
  primaryCta: z.string().optional(),
  optionalNotes: z.string().optional(),
  ghlVoiceAgentId: z.string().optional(),
  ctaCalendarLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  chatWidgetId: z.string().optional(),
  chatPersonaName: z.string().optional(),
  companyDescription: z.string().optional(),
  servicesOffered: z.string().optional(),
  serviceArea: z.string().optional(),
  customDemoMessage: z.string().optional(),
  internalNotes: z.string().optional(),
  status: z.enum(["active", "inactive", "draft"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function DemoForm() {
  const params = useParams();
  const id = params.id;
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enrichPreview, setEnrichPreview] = useState<{ summary?: string; services?: string[]; serviceArea?: string; phone?: string; hours?: string; sources?: number; limited?: boolean } | null>(null);

  const { data: openaiStatus } = useGetOpenAIStatus();
  const { data: demo, isLoading: isLoadingDemo } = useGetDemo(id as string, {
    query: { enabled: isEdit, queryKey: getGetDemoQueryKey(id as string) }
  });

  const createDemo = useCreateDemo();
  const updateDemo = useUpdateDemo();
  const enrichBusiness = useEnrichBusiness();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "", websiteUrl: "", industry: "", contactName: "", contactEmail: "",
      contactPhone: "", voiceAiPhoneNumber: "", voicePersonaName: "", voiceAiGoal: "",
      desiredTone: "", primaryCta: "", optionalNotes: "", ghlVoiceAgentId: "",
      ctaCalendarLink: "", chatWidgetId: "", chatPersonaName: "", companyDescription: "",
      servicesOffered: "", serviceArea: "", customDemoMessage: "", internalNotes: "",
      status: "draft",
    },
  });

  useEffect(() => {
    if (demo && isEdit) {
      form.reset({
        companyName: demo.companyName,
        websiteUrl: demo.websiteUrl,
        industry: demo.industry || "",
        contactName: demo.contactName || "",
        contactEmail: demo.contactEmail || "",
        contactPhone: demo.contactPhone || "",
        voiceAiPhoneNumber: demo.voiceAiPhoneNumber || "",
        voicePersonaName: demo.voicePersonaName || "",
        voiceAiGoal: demo.voiceAiGoal || "",
        desiredTone: demo.desiredTone || "",
        primaryCta: demo.primaryCta || "",
        optionalNotes: demo.optionalNotes || "",
        ghlVoiceAgentId: demo.ghlVoiceAgentId || "",
        ctaCalendarLink: demo.ctaCalendarLink || "",
        chatWidgetId: demo.chatWidgetId || "",
        chatPersonaName: demo.chatPersonaName || "",
        companyDescription: demo.companyDescription || "",
        servicesOffered: demo.servicesOffered || "",
        serviceArea: demo.serviceArea || "",
        customDemoMessage: demo.customDemoMessage || "",
        internalNotes: demo.internalNotes || "",
        status: (demo.status === "active" || demo.status === "inactive" || demo.status === "draft") ? demo.status : "draft",
      });
    }
  }, [demo, isEdit, form]);

  const handleEnrichWithAI = async () => {
    const values = form.getValues();
    if (!values.companyName || !values.websiteUrl) {
      toast({ title: "Need business name and website URL first", variant: "destructive" });
      return;
    }
    if (!values.voiceAiGoal) {
      toast({ title: "Voice Agent Goal is required to enrich.", variant: "destructive" });
      return;
    }
    setEnrichPreview(null);
    enrichBusiness.mutate({
      data: {
        businessName: values.companyName,
        websiteUrl: values.websiteUrl,
        industry: values.industry || undefined,
        agentGoal: values.voiceAiGoal,
        tone: values.desiredTone || undefined,
        primaryCta: values.primaryCta || undefined,
        optionalNotes: values.optionalNotes || undefined,
      }
    }, {
      onSuccess: (res) => {
        const profile = res.businessProfile;
        const pkg = res.voiceAgentPackage;
        // Pre-fill fields from enrichment, but only when empty so we don't overwrite user input
        const updates: Partial<FormValues> = {};
        if (!values.industry && profile.industry && profile.industry !== "unknown") updates.industry = profile.industry;
        if (!values.companyDescription && profile.summary && profile.summary !== "unknown") updates.companyDescription = profile.summary;
        if (!values.servicesOffered && profile.services?.length) updates.servicesOffered = profile.services.join(", ");
        if (!values.serviceArea && profile.serviceArea && profile.serviceArea !== "unknown") updates.serviceArea = profile.serviceArea;
        if (!values.voicePersonaName && pkg.agentName) updates.voicePersonaName = pkg.agentName;
        if (Object.keys(updates).length > 0) form.reset({ ...values, ...updates });
        setEnrichPreview({
          summary: profile.summary ?? undefined,
          services: profile.services ?? undefined,
          serviceArea: profile.serviceArea ?? undefined,
          phone: profile.phone ?? undefined,
          hours: profile.hours ?? undefined,
          sources: profile.sourceNotes?.length ?? 0,
          limited: res.limitedResults,
        });
        toast({ title: res.limitedResults ? "Enrichment complete (limited results)" : "Enrichment complete" });
      },
      onError: (err: unknown) => {
        const msg = (err && typeof err === "object" && "message" in err) ? String((err as { message: unknown }).message) : "Enrichment failed";
        toast({ title: "AI enrichment failed", description: msg, variant: "destructive" });
      }
    });
  };

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      updateDemo.mutate({ id: id as string, data: values }, {
        onSuccess: (updatedDemo) => {
          toast({ title: "Demo updated successfully" });
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(updatedDemo.id) });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
          setLocation(`/demos/${updatedDemo.id}`);
        },
        onError: () => toast({ title: "Failed to update demo", variant: "destructive" }),
      });
    } else {
      createDemo.mutate({ data: values }, {
        onSuccess: (newDemo) => {
          toast({ title: "Demo created successfully" });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
          setLocation(`/demos/${newDemo.id}`);
        },
        onError: () => toast({ title: "Failed to create demo", variant: "destructive" }),
      });
    }
  };

  if (isEdit && isLoadingDemo) {
    return <div className="flex h-full items-center justify-center p-8"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  const isPending = createDemo.isPending || updateDemo.isPending;
  const aiConfigured = openaiStatus?.configured ?? false;

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" data-testid="btn-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Demo" : "Create Demo"}</h1>
          <p className="text-muted-foreground mt-1">Configure the AI demo for your prospect.</p>
        </div>
      </div>

      {!aiConfigured && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>AI Enrichment unavailable</AlertTitle>
          <AlertDescription>OpenAI is not configured. You can still create demos manually.</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Details about the prospect and their website.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} data-testid="input-company-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="websiteUrl" render={({ field }) => (
                <FormItem><FormLabel>Website URL *</FormLabel><FormControl><Input placeholder="https://acmecorp.com" {...field} data-testid="input-website-url" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input placeholder="Plumbing, Real Estate, etc." {...field} data-testid="input-industry" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-status"><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Agent Configuration</CardTitle>
              <CardDescription>Tell the AI what to research and how the voice agent should behave.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="voiceAiGoal" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Voice Agent Goal *</FormLabel>
                  <FormControl><Textarea placeholder="e.g. Answer common service questions and book appointments" className="h-20" {...field} data-testid="input-voice-goal" /></FormControl>
                  <FormDescription>Required for AI enrichment.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="desiredTone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Desired Tone</FormLabel>
                  <FormControl><Input placeholder="Friendly, professional" {...field} data-testid="input-desired-tone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="primaryCta" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary CTA</FormLabel>
                  <FormControl><Input placeholder="Book a consultation" {...field} data-testid="input-primary-cta" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="optionalNotes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Optional Notes for AI</FormLabel>
                  <FormControl><Textarea placeholder="Anything special the AI should know" className="h-20" {...field} data-testid="input-optional-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="md:col-span-2 flex flex-col gap-3">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleEnrichWithAI}
                  disabled={!aiConfigured || enrichBusiness.isPending}
                  data-testid="btn-enrich-ai"
                >
                  {enrichBusiness.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Enrich With AI (Web Search)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Uses OpenAI web search only — no website scraping. Run this after saving for full prompt generation.
                </p>
                {enrichPreview && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>{enrichPreview.limited ? "Enriched (limited info)" : "Enrichment preview"}</AlertTitle>
                    <AlertDescription>
                      <div className="text-sm space-y-1 mt-2">
                        {enrichPreview.summary && <div><span className="font-medium">Summary:</span> {enrichPreview.summary}</div>}
                        {enrichPreview.services && enrichPreview.services.length > 0 && <div><span className="font-medium">Services:</span> {enrichPreview.services.join(", ")}</div>}
                        {enrichPreview.serviceArea && <div><span className="font-medium">Service area:</span> {enrichPreview.serviceArea}</div>}
                        {enrichPreview.phone && <div><span className="font-medium">Phone:</span> {enrichPreview.phone}</div>}
                        {enrichPreview.hours && <div><span className="font-medium">Hours:</span> {enrichPreview.hours}</div>}
                        <div className="text-muted-foreground">{enrichPreview.sources ?? 0} source(s) cited</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo Display Settings</CardTitle>
              <CardDescription>Tools that appear on the public demo page.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="voiceAiPhoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Voice AI Phone Number</FormLabel><FormControl><Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-voice-phone" /></FormControl><FormDescription>The number prospects will call to test Voice AI.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ghlVoiceAgentId" render={({ field }) => (
                <FormItem><FormLabel>GHL Voice Agent ID</FormLabel><FormControl><Input placeholder="optional" {...field} data-testid="input-voice-agent-id" /></FormControl><FormDescription>For future GHL push (optional).</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="chatWidgetId" render={({ field }) => (
                <FormItem><FormLabel>GHL Chat Widget ID</FormLabel><FormControl><Input placeholder="paste-widget-id-here" {...field} data-testid="input-chat-widget" /></FormControl><FormDescription>Leave blank to use agency default.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="voicePersonaName" render={({ field }) => (
                <FormItem><FormLabel>Voice Persona Name</FormLabel><FormControl><Input placeholder="Sarah" {...field} data-testid="input-voice-persona" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="chatPersonaName" render={({ field }) => (
                <FormItem><FormLabel>Chat Persona Name</FormLabel><FormControl><Input placeholder="Support Bot" {...field} data-testid="input-chat-persona" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ctaCalendarLink" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>CTA Calendar Link</FormLabel><FormControl><Input placeholder="https://calendar.com/book" {...field} data-testid="input-calendar-link" /></FormControl><FormDescription>Where the 'Book Setup Call' button leads.</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Business Context (optional)</CardTitle>
              <CardDescription>Override or supplement what the AI finds.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="companyDescription" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Company Description</FormLabel><FormControl><Textarea placeholder="Describe the business..." className="h-24" {...field} data-testid="input-company-desc" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="servicesOffered" render={({ field }) => (
                <FormItem><FormLabel>Services Offered</FormLabel><FormControl><Textarea placeholder="Service 1, Service 2..." className="h-20" {...field} data-testid="input-services" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="serviceArea" render={({ field }) => (
                <FormItem><FormLabel>Service Area</FormLabel><FormControl><Textarea placeholder="City, State, Region..." className="h-20" {...field} data-testid="input-service-area" /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/dashboard">
              <Button variant="outline" type="button" data-testid="btn-cancel">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isPending} data-testid="btn-submit-demo">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEdit ? "Save Changes" : "Create Demo"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
