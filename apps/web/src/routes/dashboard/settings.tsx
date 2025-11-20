import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from "@/lib/auth-client";
import React from "react";
import { settingsApi, type UserSettings } from "@/lib/settings-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Trash2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute('/dashboard/settings')({
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
  const [settings, setSettings] = React.useState<UserSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [trashRetentionDays, setTrashRetentionDays] = React.useState<number>(30);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const userSettings = await settingsApi.getSettings();
      setSettings(userSettings);
      setTrashRetentionDays(userSettings.trashRetentionDays);
    } catch (err) {
      console.error("Failed to load settings:", err);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedSettings = await settingsApi.updateSettings({
        trashRetentionDays,
      });
      setSettings(updatedSettings);
      toast.success("Settings saved successfully");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings && settings.trashRetentionDays !== trashRetentionDays;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Trash & Deletion
          </CardTitle>
          <CardDescription>
            Configure how long files are kept in trash before permanent deletion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="retention">Auto-delete after</Label>
            <Select
              value={trashRetentionDays.toString()}
              onValueChange={(value) => setTrashRetentionDays(parseInt(value))}
            >
              <SelectTrigger id="retention" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never (manual deletion only)</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days (default)</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {trashRetentionDays === 0
                ? "Files in trash will never be automatically deleted. You'll need to manually delete them."
                : `Files will be automatically deleted ${trashRetentionDays} days after being moved to trash.`}
            </p>
          </div>

          {hasChanges && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => settings && setTrashRetentionDays(settings.trashRetentionDays)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

