import { authClient } from "@/lib/auth-client";
import { getPasskeyAutofillPreference } from "@/lib/passkey-preferences";
import { isTauriContext } from "@/lib/platform-detection";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Fingerprint, Loader2 } from "lucide-react";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [conditionalUISupported, setConditionalUISupported] = useState<boolean>(true);
  const [isTauri, setIsTauri] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
	  remember: false,
    },
    onSubmit: async ({ value }) => {
      console.log("🔐 Attempting sign in with:", { email: value.email });
      
      try {
        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            onSuccess: () => {
              console.log("✅ Sign in successful");
              navigate({
                to: "/dashboard",
              });
              toast.success("Sign in successful");
            },
            onError: (error) => {
              console.error("❌ Sign in error:", error);
              toast.error(error.error.message || error.error.statusText || "Sign in failed");
            },
          }
        );
      } catch (error) {
        console.error("❌ Sign in exception:", error);
        toast.error("Failed to sign in. Please check if the server is running.");
      }
    },
  });

  useEffect(() => {
    // Check if running in Tauri
    const checkPlatform = () => {
      setIsTauri(isTauriContext());
    };
    checkPlatform();
  }, []);

  useEffect(() => {
    // Skip passkey setup in Tauri
    if (isTauri) {
      setConditionalUISupported(false);
      return;
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setConditionalUISupported(false);
      return;
    }

    let cancelled = false;

    const setupConditionalUI = async () => {
      try {
        const available = await window.PublicKeyCredential
          .isConditionalMediationAvailable?.();

        if (cancelled) {
          return;
        }

        if (!available) {
          setConditionalUISupported(false);
          return;
        }

        setConditionalUISupported(true);

        const shouldAttemptAutoFill = getPasskeyAutofillPreference();
        if (!shouldAttemptAutoFill) {
          return;
        }

        await authClient.signIn.passkey(
          {
            autoFill: true,
          },
          {
            onSuccess: () => {
              toast.success("Signed in with your saved passkey");
              navigate({ to: "/dashboard" });
            },
            onError: (error) => {
              console.warn("Passkey auto-fill failed", error);
            },
          },
        );
      } catch (error) {
        if (!cancelled) {
          console.warn("Conditional UI setup failed", error);
          setConditionalUISupported(false);
        }
      }
    };

    void setupConditionalUI();

    return () => {
      cancelled = true;
    };
  }, [navigate, isTauri]);

  const handlePasskeySignIn = async () => {
    if (isTauri) {
      toast.error("Passkeys are not supported in the desktop app. Please use the web version.");
      return;
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("Passkeys are not supported in this environment");
      return;
    }

    setIsPasskeyLoading(true);
    try {
      await authClient.signIn.passkey(
        {},
        {
          onSuccess: () => {
            toast.success("Signed in with passkey");
            navigate({ to: "/dashboard" });
          },
          onError: (error) => {
            toast.error(error.error.message || "Passkey sign-in failed");
          },
        },
      );
    } catch (error) {
      console.error("Passkey sign-in error", error);
      toast.error("Passkey sign-in failed");
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  if (isPending) {
    return <Loader />;
  }

  // Show regular sign-in form
  return (
    <div className="w-auto m-auto text-gray-900 dark:text-white transition-colors duration-300">
      {/* Logo and Heading */}
      <div className="flex flex-col items-center text-center mb-6">
        <img
          src="/web_logo.svg"
          alt="KryptVault Logo"
          width={40}
          height={40}
          className="mb-2 stroke-black"
        />
        <h1 className="text-3xl md:text-3xl font-bold mb-2 whitespace-nowrap">
          Welcome to KryptVault
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
          >
            Sign Up
          </button>
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("📝 Form submitted, values:", {
            email: form.state.values.email,
            password: form.state.values.password ? "***" : "(empty)",
          });
          form.handleSubmit();
        }}
        className="space-y-4 w-full max-w-md mx-auto px-1 my-auto"
      >
        {/* Email */}
        <form.Field name="email">
          {(field) => (
            <div>
              <Label
                htmlFor={field.name}
                className="text-sm font-medium mb-1.5 block"
              >
                Email
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value as string}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg text-base px-3.5"
                placeholder="you@example.com"
                autoComplete="username webauthn"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {String(field.state.meta.errors[0])}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Password */}
        <form.Field name="password">
          {(field) => (
            <div>
              <Label
                htmlFor={field.name}
                className="text-sm font-medium mb-1.5 block"
              >
                Password
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg text-base px-3.5"
                placeholder="••••••••"
                autoComplete="current-password webauthn"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {String(field.state.meta.errors[0])}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              className=""
              onCheckedChange={(checked) =>
                form.setFieldValue("remember", checked === true)
              }
            />
            <Label
              htmlFor="remember"
              className="text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Remember me
            </Label>
          </div>
          <button
            type="button"
            onClick={() => toast.info("Forgot password clicked")}
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
          >
            Forgot password?
          </button>
        </div>

        {/* Sign In button */}
        <form.Subscribe>
          {(state) => (
            <div className="relative w-full pt-2">
              <Button
                type="submit"
                className="h-11 w-full text-base font-semibold rounded-lg transition"
                disabled={!state.canSubmit || state.isSubmitting}
              >
                {state.isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          )}
        </form.Subscribe>

        {/* Divider - Only show if not in Tauri */}
        {!isTauri && (
          <>
            <div className="flex items-center my-4">
              <div className="grow border-t border-gray-300 dark:border-gray-700"></div>
              <span className="mx-3 text-gray-500 dark:text-gray-400 text-xs">
                or Sign In with
              </span>
              <div className="grow border-t border-gray-300 dark:border-gray-700"></div>
            </div>

            {/* Sign in with Passkey */}
            <div className="relative w-full">
              <Button
                type="button"
                onClick={handlePasskeySignIn}
                variant={"outline"}
                className="h-11 w-full text-sm font-semibold rounded-lg"
                disabled={isPasskeyLoading}
              >
                {isPasskeyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Fingerprint className="w-4 h-4" />
                )}
                {isPasskeyLoading ? "Signing in..." : "Passkey"}
              </Button>
              {!conditionalUISupported && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Your browser does not support passkey autofill yet, but you can still
                  use the button above to sign in.
                </p>
              )}
            </div>
          </>
        )}
      </form>
      
      {/* Tauri notice */}
      {isTauri && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Desktop App:</strong> Passkey sign-in is not available. Use email and password to continue.
          </p>
        </div>
      )}
    </div>
  );
}
