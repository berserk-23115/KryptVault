import { authClient } from "@/lib/auth-client";
import {
  getPasskeyAutofillPreference,
  setPasskeyAutofillPreference,
} from "@/lib/passkey-preferences";
import { isTauriContext } from "@/lib/platform-detection";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AttachmentPreference = "auto" | "platform" | "cross-platform";

type PasskeyRecord = {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string | null;
  createdAt?: string | Date | null;
  credentialID?: string;
  aaguid?: string | null;
};

const attachmentOptions: { value: AttachmentPreference; label: string; helper: string }[] = [
  {
    value: "auto",
    label: "Let browser decide",
    helper: "Allow platform or roaming authenticators",
  },
  {
    value: "platform",
    label: "This device (Touch ID, Face ID)",
    helper: "Best UX for personal laptops and phones",
  },
  {
    value: "cross-platform",
    label: "Security key / roaming",
    helper: "Perfect for hardware keys that work across devices",
  },
];

export const Route = createFileRoute("/dashboard/settings")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function RouteComponent() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(isTauriContext());
  }, []);

  if (isTauri) {
    return (
      <div className="flex h-full w-full flex-col gap-6 p-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Account settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Fingerprint className="h-4 w-4" /> Passkeys
              </CardTitle>
              <CardDescription>
                Passkey authentication for passwordless sign-in.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Passkeys are not available in the desktop app
              </p>
              <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                Due to platform limitations, passkey authentication is only available in the web version.
                Please use <strong>https://your-app-domain.com</strong> to manage passkeys and sign in with biometrics.
              </p>
              <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                You can continue using email and password authentication in the desktop app.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage passkeys and browser capabilities for passwordless sign-in.
        </p>
      </header>

      <PasskeyManager />
    </div>
  );
}

function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState<PasskeyRecord | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [attachmentPreference, setAttachmentPreference] = useState<AttachmentPreference>("auto");
  const [registering, setRegistering] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [conditionalSupported, setConditionalSupported] = useState<boolean | null>(null);

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  };

  const formatDeviceType = (deviceType?: string | null) => {
    if (!deviceType) return "Unknown";
    if (deviceType === "multiDevice") return "Roaming";
    if (deviceType === "singleDevice") return "This device";
    return deviceType;
  };

  const parseTransports = (value?: string | null) => {
    if (!value) return [] as string[];
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  };

  const loadPasskeys = useCallback(async () => {
    try {
      setLoading(true);
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) {
        throw new Error(result.error.message || "Failed to load passkeys");
      }
      setPasskeys(result.data || []);
    } catch (error) {
      console.error("Passkey fetch error", error);
      toast.error(error instanceof Error ? error.message : "Unable to fetch passkeys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  useEffect(() => {
    setAutoFillEnabled(getPasskeyAutofillPreference());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setConditionalSupported(false);
      return;
    }

    let active = true;
    const detectSupport = async () => {
      try {
        const supported = await window.PublicKeyCredential
          .isConditionalMediationAvailable?.();
        if (active) {
          setConditionalSupported(Boolean(supported));
        }
      } catch {
        if (active) {
          setConditionalSupported(false);
        }
      }
    };

    void detectSupport();

    return () => {
      active = false;
    };
  }, []);

  const refreshPasskeys = async () => {
    try {
      setRefreshing(true);
      await loadPasskeys();
      toast.success("Passkeys refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddPasskey = async () => {
    if (isTauriContext()) {
      toast.error("Passkeys are not supported in the desktop app");
      return;
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("Passkeys are not supported in this environment yet");
      return;
    }

    const formattedName = newPasskeyName.trim();
    setRegistering(true);
    try {
      const payload: Parameters<typeof authClient.passkey.addPasskey>[0] = {
        name: formattedName || undefined,
      };
      if (attachmentPreference !== "auto") {
        payload.authenticatorAttachment = attachmentPreference;
      }

      const result = await authClient.passkey.addPasskey(payload);
      if (result?.error) {
        throw new Error(result.error.message || "Failed to register passkey");
      }

      toast.success("Passkey registered successfully");
      setNewPasskeyName("");
      setAddDialogOpen(false);
      await loadPasskeys();
    } catch (error) {
      console.error("Add passkey failed", error);
      toast.error(error instanceof Error ? error.message : "Passkey registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleOpenRenameDialog = (passkey: PasskeyRecord) => {
    setSelectedPasskey(passkey);
    setRenameValue(passkey.name || "");
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!selectedPasskey) return;
    const formatted = renameValue.trim();
    if (!formatted) {
      toast.error("Passkey name cannot be empty");
      return;
    }

    setRenaming(true);
    try {
      const result = await authClient.passkey.updatePasskey({
        id: selectedPasskey.id,
        name: formatted,
      });

      if (result?.error) {
        throw new Error(result.error.message || "Unable to rename passkey");
      }

      toast.success("Passkey renamed");
      setRenameDialogOpen(false);
      setSelectedPasskey(null);
      await loadPasskeys();
    } catch (error) {
      console.error("Rename passkey failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to rename passkey");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (passkey: PasskeyRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${passkey.name || "Unnamed passkey"}"?`,
    );
    if (!confirmed) return;

    setDeletingId(passkey.id);
    try {
      const result = await authClient.passkey.deletePasskey({ id: passkey.id });
      if (result?.error) {
        throw new Error(result.error.message || "Unable to delete passkey");
      }
      toast.success("Passkey deleted");
      await loadPasskeys();
    } catch (error) {
      console.error("Delete passkey failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete passkey");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAutoFillToggle = (enabled: boolean) => {
    setAutoFillEnabled(enabled);
    setPasskeyAutofillPreference(enabled);
    toast.success(enabled ? "Passkey autofill enabled" : "Passkey autofill disabled");
  };

  const handleCheckSupport = async () => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setConditionalSupported(false);
      toast.error("This browser cannot use WebAuthn passkeys yet");
      return;
    }

    try {
      const supported = await window.PublicKeyCredential.isConditionalMediationAvailable?.();
      setConditionalSupported(Boolean(supported));
      if (supported) {
        toast.success("Conditional UI is supported");
      } else {
        toast.error("Conditional UI is not supported in this browser");
      }
    } catch (error) {
      console.warn("Conditional UI detection failed", error);
      setConditionalSupported(false);
      toast.error("Unable to detect browser support");
    }
  };

  const totalPasskeys = passkeys.length;
  const backedUpCount = useMemo(
    () => passkeys.filter((pk) => pk.backedUp).length,
    [passkeys],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Fingerprint className="h-4 w-4" /> Passkeys
            </CardTitle>
            <CardDescription>
              Register hardware or biometric authenticators for passwordless sign-in.
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPasskeys}
                disabled={refreshing || loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="sr-only">Refresh</span>
              </Button>

              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <KeyRound className="h-4 w-4" /> Add passkey
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Register a passkey</DialogTitle>
                    <DialogDescription>
                      You will be prompted by your browser to select a biometric or security key.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="passkey-name">Passkey name</Label>
                      <Input
                        id="passkey-name"
                        placeholder="e.g. MacBook Touch ID"
                        value={newPasskeyName}
                        onChange={(event) => setNewPasskeyName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passkey-attachment">Authenticator preference</Label>
                      <Select
                        value={attachmentPreference}
                        onValueChange={(value: AttachmentPreference) =>
                          setAttachmentPreference(value)
                        }
                      >
                        <SelectTrigger id="passkey-attachment">
                          <SelectValue placeholder="Choose option" />
                        </SelectTrigger>
                        <SelectContent>
                          {attachmentOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.helper}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleAddPasskey}
                      disabled={registering}
                      className="gap-2"
                    >
                      {registering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Fingerprint className="h-4 w-4" />
                      )}
                      {registering ? "Waiting for browser..." : "Create passkey"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              Passkeys are stored on your devices. If you lose access to all registered
              devices, keep a fallback security key or password handy.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Badge variant="outline">{totalPasskeys} total</Badge>
              <Badge variant="outline">{backedUpCount} backed up</Badge>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Fetching passkeys...</p>
          ) : passkeys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">No passkeys yet</p>
              <p className="text-sm text-muted-foreground">
                Add one to sign in with biometrics or hardware keys.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-2">
                    <div>
                      <p className="text-base font-semibold">
                        {passkey.name || "Unnamed passkey"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDate(passkey.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {formatDeviceType(passkey.deviceType)}
                      </Badge>
                      <Badge variant={passkey.backedUp ? "default" : "destructive"}>
                        {passkey.backedUp ? "Synced" : "Local only"}
                      </Badge>
                      {parseTransports(passkey.transports).map((transport) => (
                        <Badge key={transport} variant="outline">
                          {transport}
                        </Badge>
                      ))}
                    </div>
                    {passkey.credentialID && (
                      <p className="text-xs text-muted-foreground break-all">
                        Credential ID: {passkey.credentialID}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleOpenRenameDialog(passkey)}
                    >
                      <Pencil className="h-4 w-4" /> Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-red-600 hover:text-red-600"
                      onClick={() => handleDelete(passkey)}
                      disabled={deletingId === passkey.id}
                    >
                      {deletingId === passkey.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
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
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-4 w-4" /> Browser & autofill
            </CardTitle>
            <CardDescription>
              Control conditional UI (WebAuthn autofill) and verify device support.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">Passkey autofill on login</p>
              <p className="text-sm text-muted-foreground">
                When enabled, compatible browsers will show a passkey prompt automatically on the login page.
              </p>
            </div>
            <Switch
              checked={autoFillEnabled}
              onCheckedChange={handleAutoFillToggle}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Conditional UI support</p>
                <p className="text-sm text-muted-foreground">
                  {conditionalSupported === null
                    ? "Checking browser capabilities..."
                    : conditionalSupported
                      ? "Supported — your login page can prompt passkeys automatically."
                      : "Not supported — users must click the passkey button."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCheckSupport}
              >
                <RefreshCw className="h-4 w-4" /> Re-check
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: Keep at least one platform passkey plus a roaming key for recovery. Browsers like Chrome and Safari expose passkeys via the "google password manager" or iCloud Keychain.
            </p>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Need help testing? Use Chrome DevTools → More tools → WebAuthn to emulate authenticators.
        </CardFooter>
      </Card>

      <Dialog open={renameDialogOpen} onOpenChange={(open) => {
        setRenameDialogOpen(open);
        if (!open) {
          setSelectedPasskey(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename passkey</DialogTitle>
            <DialogDescription>
              Give this passkey a descriptive label so you can recognise it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-passkey">Passkey name</Label>
            <Input
              id="rename-passkey"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={renaming} className="gap-2">
              {renaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {renaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

