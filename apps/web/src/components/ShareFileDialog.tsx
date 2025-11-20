import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  searchUsers,
  getUserPublicKey,
  shareFile,
  getFileAccessList,
  revokeAccess,
} from "@/lib/sharing-api";
import { shareFileKey } from "@/lib/tauri-crypto";
import { Loader2, Search, Share2, Trash2, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShareFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  wrappedDek: string;
  currentUserId?: string; // Current logged-in user's ID
  onShareComplete?: () => void;
}

interface SearchedUser {
  userId: string;
  name: string;
  email: string;
  image?: string;
  hasKeypair: string | null;
}

interface AccessUser {
  userId: string;
  name: string;
  email: string;
  sharedBy?: string;
  sharedAt?: Date;
}

export function ShareFileDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  wrappedDek,
  currentUserId,
  onShareComplete,
}: ShareFileDialogProps) {
  const [email, setEmail] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchedUser[]>([]);
  const [accessList, setAccessList] = React.useState<{
    owner?: AccessUser;
    sharedWith: AccessUser[];
  }>({ sharedWith: [] });
  const [loadingAccess, setLoadingAccess] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"share" | "manage">("share");

  // Load access list when dialog opens
  React.useEffect(() => {
    if (open) {
      loadAccessList();
      setEmail("");
      setSearchResults([]);
    }
  }, [open, fileId]);

  const loadAccessList = async () => {
    try {
      setLoadingAccess(true);
      const list = await getFileAccessList(fileId);
      
      // Filter out the owner from the sharedWith list
      const filteredSharedWith = list.sharedWith.filter(
        user => user.userId !== list.owner?.userId
      );
      
      setAccessList({
        owner: list.owner,
        sharedWith: filteredSharedWith,
      });
    } catch (error) {
      console.error("Failed to load access list:", error);
      toast.error("Failed to load access list");
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleSearch = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      setSearching(true);
      const users = await searchUsers(email);
      setSearchResults(users);

      if (users.length === 0) {
        toast.info("No users found with that email");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleShare = async (recipientUserId: string, recipientEmail: string) => {
    try {
      setSharing(true);

      // Get user's keys from localStorage (in production, use keychain)
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        toast.error("You need to set up encryption first");
        return;
      }

      let userKeys;
      try {
        userKeys = JSON.parse(userKeysStr);
        console.log("🔑 User keys structure:", Object.keys(userKeys));
      } catch (e) {
        toast.error("Invalid keypair data in localStorage");
        return;
      }

      // Get the keys with fallback for both naming conventions
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      if (!userPublicKey || !userPrivateKey) {
        console.error("Missing keys:", { userPublicKey: !!userPublicKey, userPrivateKey: !!userPrivateKey });
        toast.error("Incomplete keypair data. Please regenerate your encryption keys.");
        return;
      }

      // Get recipient's public key
      console.log("🔍 Getting recipient public key for:", recipientUserId);
      const recipient = await getUserPublicKey(recipientUserId);
      console.log("✅ Recipient public key:", recipient.x25519PublicKey);

      // Re-wrap DEK for recipient
      console.log("🔄 Re-wrapping DEK...");
      console.log("  - Wrapped DEK (first 50 chars):", wrappedDek.substring(0, 50) + "...");
      console.log("  - User public key (first 20 chars):", userPublicKey.substring(0, 20) + "...");
      console.log("  - User private key exists:", !!userPrivateKey);
      console.log("  - Recipient public key (first 20 chars):", recipient.x25519PublicKey.substring(0, 20) + "...");

      const wrappedForRecipient = await shareFileKey(
        wrappedDek,
        userPublicKey,
        userPrivateKey,
        recipient.x25519PublicKey
      );

      console.log("✅ DEK re-wrapped for recipient");

      // Share on server
      console.log("📤 Sharing on server...");
      await shareFile({
        fileId,
        recipientUserId,
        wrappedDek: wrappedForRecipient,
      });

      toast.success(`File shared with ${recipientEmail}`);
      
      // Refresh access list
      await loadAccessList();
      setSearchResults([]);
      setEmail("");
      
      onShareComplete?.();
    } catch (error) {
      console.error("❌ Share error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to share file"
      );
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (recipientUserId: string, recipientEmail: string) => {
    if (!confirm(`Revoke access for ${recipientEmail}?`)) {
      return;
    }

    try {
      await revokeAccess(fileId, recipientUserId);
      toast.success(`Access revoked for ${recipientEmail}`);
      await loadAccessList();
    } catch (error) {
      console.error("Revoke error:", error);
      toast.error("Failed to revoke access");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{fileName}"
          </DialogTitle>
          <DialogDescription>
            Share this encrypted file with other users securely
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === "share" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("share")}
            className="rounded-b-none"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            variant={activeTab === "manage" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("manage")}
            className="rounded-b-none"
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Access
          </Button>
        </div>

        {activeTab === "share" && (
          <div className="space-y-4">
            {/* Search Section */}
            <div className="space-y-2">
              <Label htmlFor="email">Search user by email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching}
                  size="icon"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Search Results</Label>
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {!user.hasKeypair && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                              ⚠️ User hasn't set up encryption yet
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleShare(user.userId, user.email)}
                          disabled={sharing || !user.hasKeypair}
                        >
                          {sharing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Share"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {activeTab === "manage" && (
          <div className="space-y-4">
            {loadingAccess ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Owner */}
                {accessList.owner && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Owner
                    </Label>
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="font-medium">{accessList.owner.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {accessList.owner.email}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Shared With */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Shared With ({accessList.sharedWith.length})
                  </Label>
                  {accessList.sharedWith.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Not shared with anyone yet
                    </p>
                  ) : (
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {accessList.sharedWith.map((user) => (
                          <div
                            key={user.userId}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{user.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {user.email}
                              </p>
                              {user.sharedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Shared on{" "}
                                  {new Date(user.sharedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(user.userId, user.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
