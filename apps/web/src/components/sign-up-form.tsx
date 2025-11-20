import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Eye, EyeOff, X } from "lucide-react";

// Password validation schema
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one symbol");

// Function to calculate password strength
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

// Function to extract error message
const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  return typeof error === "object" ? JSON.stringify(error) : String(error);
};

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
      confirmPassword: "",
      remember: false,
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Sign up successful!");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: passwordSchema,
        confirmPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
        remember: z.boolean(),
      }),
    },
  });

  if (isPending) return <Loader />;

  return (
    <div className="w-full mx-auto text-gray-900 dark:text-white transition-colors duration-300">
      {/* Logo and Heading */}
      <div className="flex flex-col items-center text-center mb-6">
        <img
          src="/web_logo.svg"
          alt="KryptVault Logo"
          width={40}
          height={40}
          className="mb-2 invert dark:invert-0"
        />
        <h1 className="text-3xl md:text-3xl font-bold mb-2 whitespace-nowrap">
          Welcome to KryptVault
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Already have an account?{" "}
          <button
            onClick={onSwitchToSignIn}
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
          >
            Sign In
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
        className="space-y-2 w-full mx-auto"
      >
        {/* Name */}
        <form.Field name="name">
          {(field) => (
            <div>
              <Label
                htmlFor={field.name}
                className="text-sm font-medium mb-1.5 block"
              >
                Name
              </Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg text-base px-3.5"
                placeholder="Ayush Kumar Anand"
              />
              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-1"
                >
                  {getErrorMessage(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg text-base px-3.5"
                placeholder="you@example.com"
              />
              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-1"
                >
                  {getErrorMessage(error)}
                </p>
              ))}
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
              {/* Password Strength Indicator */}
              {field.state.value && (
                <div className="mt-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                          bar <= calculatePasswordStrength(field.state.value).bars
                            ? "bg-indigo-600 dark:bg-indigo-400"
                            : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      ></div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
                    {calculatePasswordStrength(field.state.value).level}
                  </p>
                </div>
              )}

              {/* Password Requirements */}
              {field.state.value && (
                <div className="space-y-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
                  <p>Password requirements:</p>
                  <div className="space-y-1 ml-2">
                    <p className={field.state.value.length >= 8 ? "text-green-600 dark:text-green-400" : ""}>
                      {field.state.value.length >= 8 ? "✓" : "○"} At least 8 characters
                    </p>
                    <p className={/[0-9]/.test(field.state.value) ? "text-green-600 dark:text-green-400" : ""}>
                      {/[0-9]/.test(field.state.value) ? "✓" : "○"} At least one number
                    </p>
                    <p className={/[!@#$%^&*(),.?":{}|<>]/.test(field.state.value) ? "text-green-600 dark:text-green-400" : ""}>
                      {/[!@#$%^&*(),.?":{}|<>]/.test(field.state.value) ? "✓" : "○"} At least one symbol (!@#$%^&*...)
                    </p>
                  </div>
                </div>
              )}

              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-2"
                >
                  {getErrorMessage(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        {/* Confirm Password */}
        <form.Field name="confirmPassword">
          {(field) => (
            <div>
              <Label
                htmlFor={field.name}
                className="text-sm font-medium mb-1.5 block"
              >
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showConfirmPassword ? "text" : "password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-11 rounded-lg text-base px-3.5 pr-10"
                  placeholder="••••••••"
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
              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-1"
                >
                  {getErrorMessage(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        {/* Submit */}
        <div className="flex flex-col gap-3 pt-4">
          

          {/* Submit */}
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                className="h-11 w-full text-base font-semibold rounded-lg transition"
                disabled={!state.canSubmit || state.isSubmitting}
              >
                {state.isSubmitting ? "Creating..." : "Sign Up"}
              </Button>
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
        </div>
      </form>
    </div>
  );
}
