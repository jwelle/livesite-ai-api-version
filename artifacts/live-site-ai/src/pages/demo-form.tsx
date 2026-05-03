import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateDemo,
  useUpdateDemo,
  useGetDemo,
  useAnalyzeDemoWebsite,
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { Link } from "wouter";
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

  const { data: demo, isLoading: isLoadingDemo } = useGetDemo(id as string, {
    query: {
      enabled: isEdit,
      queryKey: getGetDemoQueryKey(id as string)
    }
  });

  const createDemo = useCreateDemo();
  const updateDemo = useUpdateDemo();
  const analyzeWebsite = useAnalyzeDemoWebsite();

  const runAnalysis = (demoId: string, onDone?: () => void) => {
    analyzeWebsite.mutate(
      { id: demoId, data: {} },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(demoId) });
          const sourceLabel = data.source === "openai" ? "OpenAI" : "Basic parser";
          toast({
            title: `Website analyzed (${sourceLabel})`,
            description: data.warnings.length > 0 ? data.warnings[0] : "Open the demo to review and apply suggestions.",
          });
          onDone?.();
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { error?: string } }; message?: string };
          const msg = e?.response?.data?.error || e?.message || "Failed to analyze website";
          toast({ title: "Website analysis failed", description: msg, variant: "destructive" });
          onDone?.();
        },
      },
    );
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      websiteUrl: "",
      industry: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      voiceAiPhoneNumber: "",
      voicePersonaName: "",
      voiceAiGoal: "",
      ctaCalendarLink: "",
      chatWidgetId: "",
      chatPersonaName: "",
      companyDescription: "",
      servicesOffered: "",
      serviceArea: "",
      customDemoMessage: "",
      internalNotes: "",
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
        ctaCalendarLink: demo.ctaCalendarLink || "",
        chatWidgetId: demo.chatWidgetId || "",
        chatPersonaName: demo.chatPersonaName || "",
        companyDescription: demo.companyDescription || "",
        servicesOffered: demo.servicesOffered || "",
        serviceArea: demo.serviceArea || "",
        customDemoMessage: demo.customDemoMessage || "",
        internalNotes: demo.internalNotes || "",
        status: demo.status as "active" | "inactive" | "draft",
      });
    }
  }, [demo, isEdit, form]);

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      updateDemo.mutate({ id: id as string, data: values }, {
        onSuccess: (updatedDemo) => {
          toast({ title: "Demo updated successfully" });
          queryClient.invalidateQueries({ queryKey: getGetDemoQueryKey(updatedDemo.id) });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
          setLocation(`/demos/${updatedDemo.id}`);
        },
        onError: () => {
          toast({ title: "Failed to update demo", variant: "destructive" });
        }
      });
    } else {
      createDemo.mutate({ data: values }, {
        onSuccess: (newDemo) => {
          toast({ title: "Demo created successfully" });
          queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
          setLocation(`/demos/${newDemo.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create demo", variant: "destructive" });
        }
      });
    }
  };

  if (isEdit && isLoadingDemo) {
    return <div className="flex h-full items-center justify-center p-8"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  const isPending = createDemo.isPending || updateDemo.isPending;

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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Details about the prospect and their website.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} data-testid="input-company-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="https://acmecorp.com" {...field} data-testid="input-website-url" />
                      </FormControl>
                      {isEdit && id ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => runAnalysis(id)}
                          disabled={analyzeWebsite.isPending || !field.value}
                          data-testid="btn-inline-analyze"
                        >
                          {analyzeWebsite.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {demo?.websiteAnalyzedAt ? "Re-analyze" : "Analyze"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={form.handleSubmit((vals) => {
                            if (!vals.websiteUrl || !vals.companyName) {
                              toast({ title: "Add a company name and website first" });
                              return;
                            }
                            createDemo.mutate({ data: vals }, {
                              onSuccess: (newDemo) => {
                                toast({ title: "Demo created — analyzing website…" });
                                queryClient.invalidateQueries({ queryKey: getGetDemosQueryKey() });
                                runAnalysis(newDemo.id, () => setLocation(`/demos/${newDemo.id}`));
                              },
                              onError: () => toast({ title: "Failed to create demo", variant: "destructive" }),
                            });
                          })}
                          disabled={createDemo.isPending || analyzeWebsite.isPending || !field.value}
                          data-testid="btn-inline-analyze"
                        >
                          {createDemo.isPending || analyzeWebsite.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Save & Analyze
                        </Button>
                      )}
                    </div>
                    <FormDescription>
                      Analyze fetches the homepage and generates a tailored AI prompt and suggestions.
                    </FormDescription>
                    {isEdit && demo?.websiteAnalyzedAt && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Badge variant="outline" data-testid="badge-form-analysis-status">
                          {demo.websiteAnalysisStatus === "completed"
                            ? "Analyzed"
                            : demo.websiteAnalysisStatus === "failed"
                              ? "Last attempt failed"
                              : demo.websiteAnalysisStatus === "in_progress"
                                ? "Analyzing…"
                                : "Not analyzed"}
                        </Badge>
                        <span>
                          Source: {demo.websiteAnalysisSource === "openai" ? "OpenAI" : demo.websiteAnalysisSource === "basic" ? "Basic parser" : "Manual"}
                        </span>
                        {demo.extractedBusinessSummary && (
                          <span className="line-clamp-1">· {demo.extractedBusinessSummary}</span>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Plumbing, Real Estate, etc." {...field} data-testid="input-industry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Setup the GHL tools to appear on the demo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="voiceAiPhoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice AI Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-voice-phone" />
                    </FormControl>
                    <FormDescription>The number prospects will call to test Voice AI.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chatWidgetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GHL Chat Widget ID</FormLabel>
                    <FormControl>
                      <Input placeholder="paste-widget-id-here" {...field} data-testid="input-chat-widget" />
                    </FormControl>
                    <FormDescription>Leaves blank to use agency default.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="voicePersonaName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice Persona Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Sarah" {...field} data-testid="input-voice-persona" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chatPersonaName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chat Persona Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Support Bot" {...field} data-testid="input-chat-persona" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ctaCalendarLink"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>CTA Calendar Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://calendar.com/book" {...field} data-testid="input-calendar-link" />
                    </FormControl>
                    <FormDescription>Where should the 'Book Setup Call' button lead?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Context</CardTitle>
              <CardDescription>Context used to generate the Voice AI prompt.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="companyDescription"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Company Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the business..." className="h-24" {...field} data-testid="input-company-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="servicesOffered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Services Offered</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Service 1, Service 2..." className="h-20" {...field} data-testid="input-services" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Area</FormLabel>
                    <FormControl>
                      <Textarea placeholder="City, State, Region..." className="h-20" {...field} data-testid="input-service-area" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
