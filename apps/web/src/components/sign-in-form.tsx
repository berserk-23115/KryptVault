import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { useState } from "react";
import Loader from "./loader";
import ForgotPasswordForm from "./forgot-password-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Eye, EyeOff, Fingerprint, X } from "lucide-react";

// Function to extract error message
const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  return typeof error === "object" ? JSON.stringify(error) : String(error);
};

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
    validators: {
      onSubmit: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
        remember: z.boolean(),
      }),
    },
    onSubmit: async ({ value }) => {
      console.log("🔐 Attempting sign in with:", { email: value.email });

      try {
        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
            rememberMe: value.remember
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
              toast.error(
                error.error.message ||
                  error.error.statusText ||
                  "Sign in failed"
              );
            },
          }
        );
      } catch (error) {
        console.error("❌ Sign in exception:", error);
        // toast.error(
        //   "Failed to sign in. Please check if the server is running."
        // );
      }
    },
  });

  if (isPending) {
    return <Loader />;
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <ForgotPasswordForm
        onBackToSignIn={() => setShowForgotPassword(false)}
      />
    );
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
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {field.state.meta.errors.map((error) => getErrorMessage(error)).join(", ")}
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
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-11 rounded-lg text-base px-3.5 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-2">
                  {field.state.meta.errors.map((error) => getErrorMessage(error)).join(", ")}
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
            onClick={() => setShowForgotPassword(true)}
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

        {/* Cancel Button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/" })}
          className="h-11 w-full text-base font-semibold rounded-lg transition"
        >
          Cancel
        </Button>

      </form>
    </div>
  );
}
