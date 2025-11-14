import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

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
        password: z.string().min(8, "Password must be at least 8 characters"),
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
                  {error?.toString()}
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
                  {error?.toString()}
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
              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-1"
                >
                  {error?.toString()}
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
              {field.state.meta.errors.map((error) => (
                <p
                  key={error?.toString()}
                  className="text-red-500 dark:text-red-400 text-sm mt-1"
                >
                  {error?.toString()}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        {/* Remember Me + Submit */}
        <div className="flex flex-col gap-3 pt-4">
          {/* Remember me */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              onCheckedChange={(checked) =>
                form.setFieldValue("remember", checked === true)
              }
            />
            <Label
              htmlFor="remember"
              className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Remember me
            </Label>
          </div>

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
        </div>
      </form>
    </div>
  );
}
