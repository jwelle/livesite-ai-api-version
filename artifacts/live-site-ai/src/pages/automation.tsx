import {
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  getListApiKeysQueryKey,
  useListGhlConnections,
  useCreateGhlConnection,
  useDeleteGhlConnection,
  getListGhlConnectionsQueryKey,
  useListWritebacks,
  getListWritebacksQueryKey,
  useAdminListUserApiKeys,
  useAdminCreateUserApiKey,
  useAdminRevokeUserApiKey,
  getAdminListUserApiKeysQueryKey,
  useAdminListUserGhlConnections,
  useAdminCreateUserGhlConnection,
  useAdminDeleteUserGhlConnection,
  getAdminListUserGhlConnectionsQueryKey,
  useAdminListUserWritebacks,
  getAdminListUserWritebacksQueryKey,
} from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";

type ConnectionFormState = {
  name: string;
  locationId: string;
  companyId: string;
  privateIntegrationToken: string;
  defaultWritebackMode: string;
  contactDemoUrlFieldId: string;
  opportunityDemoUrlFieldId: string;
  addNote: boolean;
  applyTag: boolean;
  successTagId: string;
  successTagName: string;
};

const DEFAULT_CONNECTION_FORM: ConnectionFormState = {
  name: "",
  locationId: "",
  companyId: "",
  privateIntegrationToken: "",
  defaultWritebackMode: "contact_note",
  contactDemoUrlFieldId: "",
  opportunityDemoUrlFieldId: "",
  addNote: true,
  applyTag: false,
  successTagId: "",
  successTagName: "",
};

export default function AutomationPage() {
  const params = useParams();
  const targetUserId = typeof params.userId === "string" ? params.userId : "";
  const isAdminTarget = !!targetUserId;
  const ownerLabel = useMemo(() => {
    if (typeof window === "undefined") return targetUserId || "your account";
    const email = new URLSearchParams(window.location.search).get("email");
    return email || targetUserId || "your account";
  }, [targetUserId]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKeyName, setApiKeyName] = useState("Automation API key");
  const [latestPlaintextKey, setLatestPlaintextKey] = useState<string | null>(null);
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(DEFAULT_CONNECTION_FORM);

  const selfApiKeys = useListApiKeys({ query: { enabled: !isAdminTarget, queryKey: getListApiKeysQueryKey() } });
  const selfConnections = useListGhlConnections({ query: { enabled: !isAdminTarget, queryKey: getListGhlConnectionsQueryKey() } });
  const selfWritebacks = useListWritebacks(undefined, {
    query: { enabled: !isAdminTarget, queryKey: getListWritebacksQueryKey(undefined) },
  });

  const adminApiKeys = useAdminListUserApiKeys(targetUserId, {
    query: { enabled: isAdminTarget && !!targetUserId, queryKey: getAdminListUserApiKeysQueryKey(targetUserId) },
  });
  const adminConnections = useAdminListUserGhlConnections(targetUserId, {
    query: { enabled: isAdminTarget && !!targetUserId, queryKey: getAdminListUserGhlConnectionsQueryKey(targetUserId) },
  });
  const adminWritebacks = useAdminListUserWritebacks(targetUserId, undefined, {
    query: { enabled: isAdminTarget && !!targetUserId, queryKey: getAdminListUserWritebacksQueryKey(targetUserId, undefined) },
  });

  const createSelfApiKey = useCreateApiKey();
  const revokeSelfApiKey = useRevokeApiKey();
  const createSelfConnection = useCreateGhlConnection();
  const deleteSelfConnection = useDeleteGhlConnection();

  const createAdminApiKey = useAdminCreateUserApiKey();
  const revokeAdminApiKey = useAdminRevokeUserApiKey();
  const createAdminConnection = useAdminCreateUserGhlConnection();
  const deleteAdminConnection = useAdminDeleteUserGhlConnection();

  const apiKeys = (isAdminTarget ? adminApiKeys.data?.items : selfApiKeys.data?.items) ?? [];
  const connections = (isAdminTarget ? adminConnections.data?.items : selfConnections.data?.items) ?? [];
  const writebacks = (isAdminTarget ? adminWritebacks.data?.items : selfWritebacks.data?.items) ?? [];

  const apiKeysLoading = isAdminTarget ? adminApiKeys.isLoading : selfApiKeys.isLoading;
  const connectionsLoading = isAdminTarget ? adminConnections.isLoading : selfConnections.isLoading;
  const writebacksLoading = isAdminTarget ? adminWritebacks.isLoading : selfWritebacks.isLoading;

  const apiKeyPath = isAdminTarget
    ? `/api/admin/users/${targetUserId}/api-keys`
    : "/api/v1/api-keys";
  const connectionPath = isAdminTarget
    ? `/api/admin/users/${targetUserId}/ghl-connections`
    : "/api/v1/ghl-connections";
  const writebackPath = isAdminTarget
    ? `/api/admin/users/${targetUserId}/writebacks`
    : "/api/v1/writebacks";

  const endpointUrl = `${window.location.origin}/api/v1/demo-requests`;
  const samplePayload = JSON.stringify(
    {
      locationId: "ghl-location-id",
      prospectName: "Acme Roofing",
      websiteUrl: "https://example.com",
      contactId: "contact-123",
      opportunityId: "opportunity-123",
      contactName: "Jane Doe",
      email: "jane@example.com",
      phone: "555-111-2222",
      source: "highlevel",
      options: { enrich: false },
    },
    null,
    2,
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [apiKeyPath] }),
      queryClient.invalidateQueries({ queryKey: [connectionPath] }),
      queryClient.invalidateQueries({ queryKey: [writebackPath] }),
    ]);
  };

  const copyText = async (value: string, successTitle: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: successTitle });
    } catch {
      toast({
        title: "Clipboard blocked by this browser",
        description: value,
      });
    }
  };

  const handleCreateApiKey = () => {
    const name = apiKeyName.trim() || "Automation API key";
    const onSuccess = async (response: { plaintextKey: string }) => {
      setLatestPlaintextKey(response.plaintextKey);
      toast({ title: "API key created" });
      await invalidate();
    };
    const onError = (error: Error) => {
      toast({
        title: "Failed to create API key",
        description: error.message,
        variant: "destructive",
      });
    };

    if (isAdminTarget) {
      createAdminApiKey.mutate({ userId: targetUserId, data: { name } }, { onSuccess, onError });
      return;
    }

    createSelfApiKey.mutate({ data: { name } }, { onSuccess, onError });
  };

  const handleRevokeApiKey = (id: string) => {
    const onSuccess = async () => {
      toast({ title: "API key revoked" });
      await invalidate();
    };
    const onError = (error: Error) => {
      toast({
        title: "Failed to revoke API key",
        description: error.message,
        variant: "destructive",
      });
    };

    if (isAdminTarget) {
      revokeAdminApiKey.mutate({ userId: targetUserId, id }, { onSuccess, onError });
      return;
    }

    revokeSelfApiKey.mutate({ id }, { onSuccess, onError });
  };

  const handleCreateConnection = () => {
    const payload = {
      name: connectionForm.name.trim(),
      locationId: connectionForm.locationId.trim(),
      companyId: connectionForm.companyId.trim() || undefined,
      privateIntegrationToken: connectionForm.privateIntegrationToken.trim(),
      defaultWritebackMode: connectionForm.defaultWritebackMode.trim() || "contact_note",
      contactDemoUrlFieldId: connectionForm.contactDemoUrlFieldId.trim() || undefined,
      opportunityDemoUrlFieldId: connectionForm.opportunityDemoUrlFieldId.trim() || undefined,
      addNote: connectionForm.addNote,
      applyTag: connectionForm.applyTag,
      successTagId: connectionForm.successTagId.trim() || undefined,
      successTagName: connectionForm.successTagName.trim() || undefined,
    };

    const onSuccess = async () => {
      setConnectionForm(DEFAULT_CONNECTION_FORM);
      toast({ title: "GHL connection saved" });
      await invalidate();
    };
    const onError = (error: Error) => {
      toast({
        title: "Failed to save GHL connection",
        description: error.message,
        variant: "destructive",
      });
    };

    if (isAdminTarget) {
      createAdminConnection.mutate({ userId: targetUserId, data: payload }, { onSuccess, onError });
      return;
    }

    createSelfConnection.mutate({ data: payload }, { onSuccess, onError });
  };

  const handleDeleteConnection = (id: string) => {
    const onSuccess = async () => {
      toast({ title: "GHL connection deleted" });
      await invalidate();
    };
    const onError = (error: Error) => {
      toast({
        title: "Failed to delete GHL connection",
        description: error.message,
        variant: "destructive",
      });
    };

    if (isAdminTarget) {
      deleteAdminConnection.mutate({ userId: targetUserId, id }, { onSuccess, onError });
      return;
    }

    deleteSelfConnection.mutate({ id }, { onSuccess, onError });
  };

  const creatingApiKey = createSelfApiKey.isPending || createAdminApiKey.isPending;
  const creatingConnection = createSelfConnection.isPending || createAdminConnection.isPending;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isAdminTarget ? (
              <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to users
              </Link>
            ) : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdminTarget ? "Manage User Automation" : "Automation Setup"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdminTarget
              ? `Configure API keys and HighLevel connection settings for ${ownerLabel}.`
              : "Manage API keys, HighLevel connections, and inbound workflow setup for your account."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings" data-testid="link-automation-settings">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open General Settings
          </Link>
        </Button>
      </div>

      {latestPlaintextKey ? (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>New API key created</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>This plaintext key is only shown once. Save it in HighLevel, Zapier, or your secret manager now.</p>
            <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs break-all">
              {latestPlaintextKey}
            </div>
            <Button size="sm" variant="outline" onClick={() => copyText(latestPlaintextKey, "API key copied")}>
              <Copy className="mr-2 h-4 w-4" />
              Copy key
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inbound API</CardTitle>
            <CardDescription>Create and revoke API keys used by HighLevel or Zapier to call Live Site AI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <Input
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="Automation API key"
                data-testid="input-api-key-name"
              />
              <Button onClick={handleCreateApiKey} disabled={creatingApiKey} data-testid="btn-create-api-key">
                <KeyRound className="mr-2 h-4 w-4" />
                {creatingApiKey ? "Creating..." : "Create API key"}
              </Button>
            </div>

            {apiKeysLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-sm text-muted-foreground">No API keys yet.</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Masked key</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs">{key.maskedKey}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.lastUsedAt ? format(new Date(key.lastUsedAt), "MMM d, yyyy") : "Never"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(key.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.revokedAt ? "destructive" : "default"}>
                            {key.revokedAt ? "revoked" : "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!!key.revokedAt}
                            onClick={() => handleRevokeApiKey(key.id)}
                            data-testid={`btn-revoke-api-key-${key.id}`}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Instructions</CardTitle>
            <CardDescription>Use this endpoint from HighLevel or Zapier, then let the workflow send the email or SMS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <div className="flex gap-2">
                <Input value={endpointUrl} readOnly data-testid="input-automation-endpoint" />
                <Button variant="outline" onClick={() => copyText(endpointUrl, "Endpoint copied")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Authorization header</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                Authorization: Bearer &lt;plaintext API key&gt;
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sample JSON body</Label>
              <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-auto whitespace-pre-wrap">{samplePayload}</pre>
            </div>
            <Alert>
              <LinkIcon className="h-4 w-4" />
              <AlertTitle>Recommended workflow split</AlertTitle>
              <AlertDescription>
                Live Site AI should create the demo and return the public link. HighLevel should store that link on the contact or opportunity and handle the actual outbound email or SMS.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>HighLevel Connection</CardTitle>
            <CardDescription>Store the Private Integration Token and writeback defaults for this account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ghl-name">Connection name</Label>
                <Input id="ghl-name" value={connectionForm.name} onChange={(e) => setConnectionForm((s) => ({ ...s, name: e.target.value }))} data-testid="input-ghl-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input id="ghl-location-id" value={connectionForm.locationId} onChange={(e) => setConnectionForm((s) => ({ ...s, locationId: e.target.value }))} data-testid="input-ghl-location-id" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-company-id">Company ID</Label>
                <Input id="ghl-company-id" value={connectionForm.companyId} onChange={(e) => setConnectionForm((s) => ({ ...s, companyId: e.target.value }))} data-testid="input-ghl-company-id" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-writeback-mode">Default writeback mode</Label>
                <Input id="ghl-writeback-mode" value={connectionForm.defaultWritebackMode} onChange={(e) => setConnectionForm((s) => ({ ...s, defaultWritebackMode: e.target.value }))} data-testid="input-ghl-writeback-mode" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ghl-token">Private Integration Token</Label>
                <Input id="ghl-token" type="password" value={connectionForm.privateIntegrationToken} onChange={(e) => setConnectionForm((s) => ({ ...s, privateIntegrationToken: e.target.value }))} data-testid="input-ghl-token" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-contact-field">Contact demo URL field ID</Label>
                <Input id="ghl-contact-field" value={connectionForm.contactDemoUrlFieldId} onChange={(e) => setConnectionForm((s) => ({ ...s, contactDemoUrlFieldId: e.target.value }))} data-testid="input-ghl-contact-field" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-opportunity-field">Opportunity demo URL field ID</Label>
                <Input id="ghl-opportunity-field" value={connectionForm.opportunityDemoUrlFieldId} onChange={(e) => setConnectionForm((s) => ({ ...s, opportunityDemoUrlFieldId: e.target.value }))} data-testid="input-ghl-opportunity-field" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-success-tag-id">Success tag ID</Label>
                <Input id="ghl-success-tag-id" value={connectionForm.successTagId} onChange={(e) => setConnectionForm((s) => ({ ...s, successTagId: e.target.value }))} data-testid="input-ghl-success-tag-id" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghl-success-tag-name">Success tag name</Label>
                <Input id="ghl-success-tag-name" value={connectionForm.successTagName} onChange={(e) => setConnectionForm((s) => ({ ...s, successTagName: e.target.value }))} data-testid="input-ghl-success-tag-name" />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Add note</div>
                  <div className="text-xs text-muted-foreground">Write the demo link into a note after creation.</div>
                </div>
                <Switch checked={connectionForm.addNote} onCheckedChange={(checked) => setConnectionForm((s) => ({ ...s, addNote: checked }))} data-testid="switch-ghl-add-note" />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Apply tag</div>
                  <div className="text-xs text-muted-foreground">Apply a success tag during a later writeback step.</div>
                </div>
                <Switch checked={connectionForm.applyTag} onCheckedChange={(checked) => setConnectionForm((s) => ({ ...s, applyTag: checked }))} data-testid="switch-ghl-apply-tag" />
              </div>
            </div>

            <Button onClick={handleCreateConnection} disabled={creatingConnection} data-testid="btn-save-ghl-connection">
              {creatingConnection ? "Saving..." : "Save GHL connection"}
            </Button>

            {connectionsLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : connections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No GHL connections saved yet.</div>
            ) : (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <div key={connection.id} className="rounded-md border p-4" data-testid={`card-ghl-connection-${connection.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-medium">{connection.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Location {connection.locationId}
                          {connection.companyId ? ` • Company ${connection.companyId}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Token {connection.tokenMasked ?? "not stored"} • Mode {connection.defaultWritebackMode}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Contact field {connection.contactDemoUrlFieldId ?? "—"} • Opportunity field {connection.opportunityDemoUrlFieldId ?? "—"}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteConnection(connection.id)} data-testid={`btn-delete-ghl-connection-${connection.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Writebacks</CardTitle>
            <CardDescription>Read-only tracking for recent writeback attempts. Real outbound execution is a later slice.</CardDescription>
          </CardHeader>
          <CardContent>
            {writebacksLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : writebacks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No writebacks recorded yet.</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Demo request</TableHead>
                      <TableHead>Attempted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {writebacks.slice(0, 10).map((writeback) => (
                      <TableRow key={writeback.id}>
                        <TableCell>
                          <Badge variant={writeback.status === "failed" ? "destructive" : writeback.status === "success" ? "default" : "secondary"}>
                            {writeback.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {writeback.targetType}
                          {writeback.targetId ? ` • ${writeback.targetId}` : ""}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{writeback.demoRequestId}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(writeback.attemptedAt), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
