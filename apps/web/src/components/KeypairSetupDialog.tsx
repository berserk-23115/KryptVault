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
import { generateUserKeypair } from "@/lib/tauri-crypto";
import { registerKeypair, getMyKeypair } from "@/lib/sharing-api";
import { toast } from "sonner";
import { Loader2, Key, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

interface KeypairSetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function KeypairSetupDialog({ open, onComplete }: KeypairSetupDialogProps) {
  const navigate = useNavigate();
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      toast.success("Logged out successfully");
      navigate({ to: "/" });
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to logout");
    }
  };

  const handleSetup = async () => {
    try {
      setGenerating(true);
      setError(null);

      // Generate keypairs
      toast.info("Generating encryption keys...");
      const keypair = await generateUserKeypair();

      // Store private keys locally (in production, use OS keychain)
      localStorage.setItem("userKeypair", JSON.stringify(keypair));

      // Register public keys with server
      toast.info("Registering public keys with server...");
      await registerKeypair(keypair.x25519_public_key, keypair.ed25519_public_key);

      toast.success("Encryption setup complete!");
      onComplete();
    } catch (err) {
      console.error("Keypair setup error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to set up encryption";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Set Up Encryption
          </DialogTitle>
          <DialogDescription>
            To share files securely, you need to generate encryption keys
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">What will happen:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Generate X25519 encryption keys</li>
                  <li>Generate Ed25519 signing keys</li>
                  <li>Store private keys securely on your device</li>
                  <li>Register public keys with the server</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert> */}

          <Alert variant="destructive">
            <AlertDescription>
              <p className="font-medium mb-1">⚠️ Important:</p>
              <p className="text-sm">
                Your private keys will be stored on this device only. If you lose them,
                you won't be able to decrypt your files.
              </p>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={generating}
            className="flex-1"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
          <Button
            onClick={handleSetup}
            disabled={generating}
            className="flex-1"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Keys...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Generate Encryption Keys
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check if user has keypairs set up
 */
export function useKeypairCheck() {
  const [hasKeypair, setHasKeypair] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(true);

  const checkKeypair = async () => {
    try {
      setChecking(true);
      
      // Check local storage first
      const localKeypair = localStorage.getItem("userKeypair");
      if (!localKeypair) {
        setHasKeypair(false);
        return;
      }

      // Verify with server
      try {
        await getMyKeypair();
        setHasKeypair(true);
      } catch {
        // Server doesn't have our public keys
        setHasKeypair(false);
      }
    } catch (err) {
      console.error("Keypair check error:", err);
      setHasKeypair(false);
    } finally {
      setChecking(false);
    }
  };

  React.useEffect(() => {
    checkKeypair();
  }, []);

  return { hasKeypair, checking, recheckKeypair: checkKeypair };
}
