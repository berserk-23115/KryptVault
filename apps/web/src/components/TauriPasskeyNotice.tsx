import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isTauriContext } from "@/lib/platform-detection";
import { AlertCircle } from "lucide-react";

export function TauriPasskeyNotice() {
  if (!isTauriContext()) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <AlertCircle className="h-4 w-4 text-yellow-600! dark:text-yellow-400!" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        Passkeys unavailable in desktop app
      </AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        Due to WebAuthn platform limitations, passkey authentication is only available in the web browser version.
        Use email and password authentication in the desktop app, or visit the web version to use passkeys.
      </AlertDescription>
    </Alert>
  );
}
