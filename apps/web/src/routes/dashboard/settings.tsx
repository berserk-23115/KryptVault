import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from "@/lib/auth-client";
import React from "react";
import { settingsApi, type UserSettings, type SecurityQuestion } from "@/lib/settings-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Save, 
  Trash2, 
  RefreshCw, 
  User, 
  Info,
  Key,
  LogOut,
  AlertTriangle,
  Check,
  Clock,
  Edit,
  Palette,
  Eye,
  EyeOff,
  Plus,
  Shield
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme-provider";
import z from "zod";

// Password validation schema (same as signup form)
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one symbol");

// Function to calculate password strength (same as signup form)
const calculatePasswordStrength = (password: string) => {
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
  };

  Object.values(checks).forEach((check) => {
    if (check) strength++;
  });

  if (strength <= 2) return { bars: 1, level: "Weak" };
  if (strength <= 4) return { bars: 2, level: "Fair" };
  return { bars: 3, level: "Strong" };
};

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
  const { session } = Route.useRouteContext();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = React.useState<UserSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [trashRetentionDays, setTrashRetentionDays] = React.useState<number>(30);
  
  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [editedName, setEditedName] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);
  
  // Password change
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  
  // Session data
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = React.useState(false);

  // Security questions
  const [securityQuestions, setSecurityQuestions] = React.useState<SecurityQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [addingQuestion, setAddingQuestion] = React.useState(false);
  const [newQuestion, setNewQuestion] = React.useState("");
  const [newAnswer, setNewAnswer] = React.useState("");
  const [showAnswer, setShowAnswer] = React.useState(false);

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

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const sessionData = await authClient.listSessions();
      setSessions(sessionData.data || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSecurityQuestions = async () => {
    try {
      setLoadingQuestions(true);
      const questions = await settingsApi.getSecurityQuestions();
      setSecurityQuestions(questions);
    } catch (err) {
      console.error("Failed to load security questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  React.useEffect(() => {
    loadSettings();
    loadSessions();
    loadSecurityQuestions();
    if (session?.data?.user?.name) {
      setEditedName(session.data.user.name);
    }
  }, [session]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const updatedSettings = await settingsApi.updateSettings({
        trashRetentionDays,
      });
      setSettings(updatedSettings);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      const errorMessage = err?.message || "Failed to save settings";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionToken: string) => {
    try {
      await authClient.revokeSession({ token: sessionToken });
      toast.success("Session revoked successfully");
      loadSessions();
    } catch (err) {
      console.error("Failed to revoke session:", err);
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await authClient.revokeOtherSessions();
      toast.success("All other sessions revoked");
      loadSessions();
    } catch (err) {
      console.error("Failed to revoke sessions:", err);
      toast.error("Failed to revoke sessions");
    }
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      setSavingProfile(true);
      await authClient.updateUser({
        name: editedName.trim(),
      });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
      // Refresh the page to update the session
      window.location.reload();
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Validate password using the same schema as signup
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      const issues = result.error.issues;
      const firstError = issues[0];
      toast.error(firstError?.message || "Password does not meet requirements");
      return;
    }

    try {
      setChangingPassword(true);
      const changeResult = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (changeResult.error) {
        toast.error(changeResult.error.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Failed to change password:", err);
      toast.error(err?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAddSecurityQuestion = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Please fill in both question and answer");
      return;
    }

    if (newQuestion.trim().length < 10) {
      toast.error("Question must be at least 10 characters");
      return;
    }

    if (newAnswer.trim().length < 2) {
      toast.error("Answer must be at least 2 characters");
      return;
    }

    try {
      setAddingQuestion(true);
      const question = await settingsApi.addSecurityQuestion({
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
      });
      setSecurityQuestions([...securityQuestions, question]);
      toast.success("Security question added successfully");
      setNewQuestion("");
      setNewAnswer("");
    } catch (err: any) {
      console.error("Failed to add security question:", err);
      toast.error(err?.message || "Failed to add security question");
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleDeleteSecurityQuestion = async (questionId: string) => {
    try {
      await settingsApi.deleteSecurityQuestion(questionId);
      setSecurityQuestions(securityQuestions.filter(q => q.id !== questionId));
      toast.success("Security question deleted successfully");
    } catch (err: any) {
      console.error("Failed to delete security question:", err);
      toast.error(err?.message || "Failed to delete security question");
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

  const user = session?.data?.user;
  const userInitials = user?.name ? user.name.charAt(0).toUpperCase() : 
                       user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account preferences and settings
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="flex w-full gap-2 bg-purple-400/20 p-1 rounded-xl ">
            {["profile", "security", "preferences", "account"].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="
                  flex-1 rounded-lg data-[state=active]:bg-purple-600
                  data-[state=active]:text-white
                  transition-all
                "
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>


        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-neutral-300 dark:border-neutral-800 shadow-none rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.image || "/profile.png"} alt={user?.name || "User"} />
                  <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-semibold">{user?.name || "User"}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {user?.emailVerified && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  {isEditingProfile ? (
                    <div className="space-y-2">
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Enter your name"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveProfile}
                          disabled={savingProfile || !editedName.trim()}
                        >
                          {savingProfile ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingProfile(false);
                            setEditedName(user?.name || "");
                          }}
                          disabled={savingProfile}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="name"
                        value={user?.name || ""}
                        disabled
                        className="bg-muted"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your email cannot be changed after registration
                  </p>
                </div>

              
              </div>
            </CardContent>
          </Card>

          {/* Password Change Section */}
          <Card className="border border-neutral-300 dark:border-neutral-800 shadow-none rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isChangingPassword ? (
                <Button onClick={() => setIsChangingPassword(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="mt-3">
                        <div className="flex gap-1.5">
                          {[1, 2, 3].map((bar) => (
                            <div
                              key={bar}
                              className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                                bar <= calculatePasswordStrength(newPassword).bars
                                  ? "bg-indigo-600 dark:bg-indigo-400"
                                  : "bg-slate-300 dark:bg-slate-700"
                              }`}
                            ></div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
                          {calculatePasswordStrength(newPassword).level}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
                      <p>Password requirements:</p>
                      <div className="space-y-1 ml-2">
                        <p className={newPassword.length >= 8 ? "text-green-600 dark:text-green-400" : ""}>
                          {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                        </p>
                        <p className={/[0-9]/.test(newPassword) ? "text-green-600 dark:text-green-400" : ""}>
                          {/[0-9]/.test(newPassword) ? "✓" : "○"} At least one number
                        </p>
                        <p className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "text-green-600 dark:text-green-400" : ""}>
                          {/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "✓" : "○"} At least one symbol (!@#$%^&*...)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        Passwords do not match
                      </p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <p className="text-green-600 dark:text-green-400 text-xs mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {changingPassword ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Change Password
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                      disabled={changingPassword}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage your active login sessions across devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((sess: any, index: number) => (
                    <div
                      key={sess.id || index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {sess.userAgent?.includes("Chrome") ? "Chrome" :
                             sess.userAgent?.includes("Firefox") ? "Firefox" :
                             sess.userAgent?.includes("Safari") ? "Safari" : "Browser"}
                          </p>
                          {sess.id === session?.data?.session?.id && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sess.ipAddress || "Unknown location"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active: {new Date(sess.updatedAt || sess.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {sess.id !== session?.data?.session?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeSession(sess.token)}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}

                  {sessions.length > 1 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <LogOut className="h-4 w-4 mr-2" />
                          Revoke All Other Sessions
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke all other sessions?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will log you out from all devices except this one. You'll need to log in again on those devices.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRevokeAllSessions}>
                            Revoke All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No active sessions found
                </p>
              )}
            </CardContent>
          </Card>

          {/* Security Questions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Questions
              </CardTitle>
              <CardDescription>
                Set up security questions for account recovery and additional verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingQuestions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Existing Questions */}
                  {securityQuestions.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <Label className="text-sm font-medium">Your Security Questions</Label>
                      {securityQuestions.map((q, index) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Question {index + 1}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{q.question}</p>
                            <p className="text-xs text-muted-foreground">
                              Added: {new Date(q.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete security question?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this security question. You won't be able to use it for account recovery.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSecurityQuestion(q.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Question Form */}
                  {securityQuestions.length < 5 && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <Label className="text-sm font-medium">Add New Security Question</Label>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="newQuestion">Question</Label>
                          <Input
                            id="newQuestion"
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            placeholder="e.g., What was the name of your first pet?"
                            disabled={addingQuestion}
                          />
                          <p className="text-xs text-muted-foreground">
                            Choose a question that only you know the answer to
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newAnswer">Answer</Label>
                          <div className="relative">
                            <Input
                              id="newAnswer"
                              type={showAnswer ? "text" : "password"}
                              value={newAnswer}
                              onChange={(e) => setNewAnswer(e.target.value)}
                              placeholder="Enter your answer"
                              disabled={addingQuestion}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAnswer(!showAnswer)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                              disabled={addingQuestion}
                            >
                              {showAnswer ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Answers are case-insensitive and stored securely
                          </p>
                        </div>

                        <Button
                          onClick={handleAddSecurityQuestion}
                          disabled={addingQuestion || !newQuestion.trim() || !newAnswer.trim()}
                          className="w-full"
                        >
                          {addingQuestion ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Security Question
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {securityQuestions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No security questions set up yet</p>
                      <p className="text-xs mt-1">Add questions to enhance your account security</p>
                    </div>
                  )}

                  {securityQuestions.length >= 5 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">Maximum of 5 security questions reached</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how KryptVault looks on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(value) => setTheme(value)}
                >
                  <SelectTrigger id="theme" className="w-full">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {theme === "system"
                    ? "Theme will match your system preferences"
                    : `Using ${theme} theme`}
                </p>
              </div>
            </CardContent>
          </Card>

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
                  <Button onClick={handleSaveSettings} disabled={saving}>
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
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Details about your KryptVault account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Account Created</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : "Unknown"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : "Unknown"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Account Status</p>
                    <p className="text-sm text-muted-foreground">
                      Active
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove all your data from our servers, including all
                      encrypted files. Your files cannot be recovered after deletion.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          const result = await settingsApi.deleteAccount();
                          toast.success(`Account deleted successfully. ${result.deletedFiles} files removed.`);
                          
                          // Sign out and redirect to login
                          await authClient.signOut();
                          
                          // Clear local storage
                          if (typeof window !== "undefined") {
                            localStorage.clear();
                          }
                          
                          // Redirect to login page
                          window.location.href = "/login";
                        } catch (err: any) {
                          console.error("Failed to delete account:", err);
                          toast.error(err?.message || "Failed to delete account");
                        }
                      }}
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-muted-foreground text-center">
                Once deleted, your account and all associated data will be permanently removed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}

