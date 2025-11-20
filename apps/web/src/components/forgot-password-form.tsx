import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Eye, EyeOff, ArrowLeft, Shield, CheckCircle } from "lucide-react";
import {
  settingsApi,
  type RecoveryQuestionsResponse,
} from "@/lib/settings-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

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

type Step = "email" | "questions" | "newPassword" | "success";

export default function ForgotPasswordForm({
  onBackToSignIn,
}: {
  onBackToSignIn: () => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<
    RecoveryQuestionsResponse["questions"]
  >([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      const response = await settingsApi.getRecoveryQuestions(email);

      if (!response.questions || response.questions.length === 0) {
        toast.error(
          "No security questions found for this account. Please contact support."
        );
        return;
      }

      setQuestions(response.questions);
      setStep("questions");
      toast.success(`Found ${response.questions.length} security question(s)`);
    } catch (err: any) {
      console.error("Failed to get recovery questions:", err);
      toast.error(err?.message || "Failed to retrieve security questions");
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if all questions are answered
    const unansweredQuestions = questions.filter((q) => !answers[q.id]?.trim());
    if (unansweredQuestions.length > 0) {
      toast.error("Please answer all security questions");
      return;
    }

    try {
      setLoading(true);
      const response = await settingsApi.verifyRecoveryAnswers({
        email,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id],
        })),
      });

      if (response.verified) {
        setRecoveryToken(response.recoveryToken);
        setStep("newPassword");
        toast.success(
          "Security questions verified! Now set your new password."
        );
      } else {
        toast.error("Incorrect answers. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to verify answers:", err);
      toast.error(err?.message || "Incorrect answers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      const issues = result.error.issues;
      const firstError = issues[0];
      toast.error(firstError?.message || "Password does not meet requirements");
      return;
    }

    try {
      setLoading(true);
      await settingsApi.resetPasswordWithToken({
        email,
        newPassword,
        recoveryToken,
      });

      setStep("success");
      toast.success("Password reset successfully!");
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      toast.error(err?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" text-gray-900 dark:text-white transition-colors duration-300">
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
          {step === "success" ? "Password Reset!" : "Forgot Password"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {step === "email" && "Enter your email to recover your account"}
          {step === "questions" && "Answer your security questions"}
          {step === "newPassword" && "Set your new password"}
          {step === "success" && "Your password has been reset successfully"}
        </p>
      </div>

      <div className="w-full px-1">
        {/* Step 1: Email */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="email"
                className="text-sm font-medium mb-1.5 block"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg text-base px-3.5"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold rounded-lg"
              disabled={loading}
            >
              {loading ? "Checking..." : "Continue"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onBackToSignIn}
              className="h-11 w-full text-base font-semibold rounded-lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </form>
        )}

        {/* Step 2: Security Questions */}
        {step === "questions" && (
          <form onSubmit={handleQuestionsSubmit} className="space-y-4">
            <div className="">
              {questions.map((question, index) => (
                <div key={question.id} className="mb-4">
                  <Label
                    htmlFor={`answer-${question.id}`}
                    className="text-sm font-medium mb-1.5 block"
                  >
                    Question {index + 1}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    {question.question}
                  </p>
                  <Input
                    id={`answer-${question.id}`}
                    type="text"
                    value={answers[question.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [question.id]: e.target.value })
                    }
                    className="h-11 rounded-lg text-base px-3.5"
                    placeholder="Your answer"
                    disabled={loading}
                  />
                </div>
              ))}
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold rounded-lg"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify Answers"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("email")}
              className="h-11 w-full text-base font-semibold rounded-lg"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === "newPassword" && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <Label
                htmlFor="newPassword"
                className="text-sm font-medium mb-1.5 block"
              >
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 rounded-lg text-base px-3.5 pr-10"
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                  disabled={loading}
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
                  <p
                    className={
                      newPassword.length >= 8
                        ? "text-green-600 dark:text-green-400"
                        : ""
                    }
                  >
                    {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                  </p>
                  <p
                    className={
                      /[0-9]/.test(newPassword)
                        ? "text-green-600 dark:text-green-400"
                        : ""
                    }
                  >
                    {/[0-9]/.test(newPassword) ? "✓" : "○"} At least one number
                  </p>
                  <p
                    className={
                      /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
                        ? "text-green-600 dark:text-green-400"
                        : ""
                    }
                  >
                    {/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "✓" : "○"} At
                    least one symbol
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium mb-1.5 block"
              >
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-lg text-base px-3.5 pr-10"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
                  disabled={loading}
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
                  <CheckCircle className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold rounded-lg"
              disabled={loading || !newPassword || !confirmPassword}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onBackToSignIn}
              className="h-11 w-full text-base font-semibold rounded-lg"
              disabled={loading}
            >
              Cancel
            </Button>
          </form>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                Password Reset Successful!
              </h2>
              <p className="text-muted-foreground">
                Your password has been successfully reset. You can now sign in
                with your new password.
              </p>
            </div>

            <Button
              onClick={onBackToSignIn}
              className="h-11 w-full text-base font-semibold rounded-lg"
            >
              Sign In Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
