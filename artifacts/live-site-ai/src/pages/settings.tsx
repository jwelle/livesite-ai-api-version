import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const settingsSchema = z.object({
  agencyName: z.string().optional(),
  agencyWebsite: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  agencyLogoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  primaryBrandColor: z.string().optional(),
  secondaryBrandColor: z.string().optional(),
  defaultVoiceAiPhone: z.string().optional(),
  defaultVoicePersonaName: z.string().optional(),
  defaultCalendarLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  defaultGhlWidgetId: z.string().optional(),
  defaultChatPersonaName: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      agencyName: "",
      agencyWebsite: "",
      agencyLogoUrl: "",
      primaryBrandColor: "",
      secondaryBrandColor: "",
      defaultVoiceAiPhone: "",
      defaultVoicePersonaName: "",
      defaultCalendarLink: "",
      defaultGhlWidgetId: "",
      defaultChatPersonaName: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        agencyName: settings.agencyName || "",
        agencyWebsite: settings.agencyWebsite || "",
        agencyLogoUrl: settings.agencyLogoUrl || "",
        primaryBrandColor: settings.primaryBrandColor || "",
        secondaryBrandColor: settings.secondaryBrandColor || "",
        defaultVoiceAiPhone: settings.defaultVoiceAiPhone || "",
        defaultVoicePersonaName: settings.defaultVoicePersonaName || "",
        defaultCalendarLink: settings.defaultCalendarLink || "",
        defaultGhlWidgetId: settings.defaultGhlWidgetId || "",
        defaultChatPersonaName: settings.defaultChatPersonaName || "",
      });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsValues) => {
    updateSettings.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-8"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Agency Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your agency profile and default AI configurations.</p>
      </div>

      <Alert className="mb-8 bg-primary/10 border-primary/20 text-primary">
        <Info className="h-4 w-4" />
        <AlertTitle>Note on Voice AI</AlertTitle>
        <AlertDescription>
          GHL Voice AI API integration is prepared but not active in this MVP. Paste your Voice AI phone number and generated prompt into HighLevel manually.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Agency Profile</CardTitle>
              <CardDescription>Your agency branding used across demos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="agencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Agency" {...field} data-testid="input-agency-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agencyWebsite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acmeagency.com" {...field} data-testid="input-agency-website" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agencyLogoUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acmeagency.com/logo.png" {...field} data-testid="input-agency-logo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default AI Settings</CardTitle>
              <CardDescription>These values will be used as defaults for new demos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="defaultGhlWidgetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default GHL Widget ID</FormLabel>
                    <FormControl>
                      <Input placeholder="widget-id" {...field} data-testid="input-default-widget-id" />
                    </FormControl>
                    <FormDescription>Global fallback if demo has none.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultVoiceAiPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Voice AI Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 000-0000" {...field} data-testid="input-default-voice-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultChatPersonaName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Chat Persona Name</FormLabel>
                    <FormControl>
                      <Input placeholder="AI Assistant" {...field} data-testid="input-default-chat-persona" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultVoicePersonaName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Voice Persona Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Sarah" {...field} data-testid="input-default-voice-persona" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultCalendarLink"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Default Calendar Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://calendar.com/book" {...field} data-testid="input-default-calendar" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettings.isPending} data-testid="btn-save-settings">
              {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
