import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge, Fingerprint } from "lucide-react";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
	  remember: false,
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/dashboard",
            });
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        remember: z.boolean(),
      }),
    },
  });

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

        {/* Divider */}
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
            onClick={() => toast.info("Passkey sign-in coming soon!")}
            variant={"outline"}
            className="h-11 w-full text-sm font-semibold rounded-lg"
          >
            <Fingerprint className="w-4 h-4" />
            Passkey
          </Button>
        </div>
      </form>
    </div>
  );
}
