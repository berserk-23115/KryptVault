"use client";

import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle, Fingerprint, Shield } from "lucide-react";
import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import GoogleIcon from "./icons/google";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();
	const lastMethod = authClient.getLastUsedLoginMethod();
	const [showTwoFactor, setShowTwoFactor] = useState(false);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [showBackupCodeInput, setShowBackupCodeInput] = useState(false);
	const [backupCode, setBackupCode] = useState("");
	const [verifying, setVerifying] = useState(false);
	const [trustDevice, setTrustDevice] = useState(false);
	const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			username: "",
			password: "",
			remember: false,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.username,
					password: value.password,
				},
				{
					onSuccess: (context) => {
						// Check if 2FA is required
						if (context.data.twoFactorRedirect) {
							setShowTwoFactor(true);
							toast.info("Please enter your 2FA code to continue");
						} else {
							router.push("/dashboard");
							toast.success("Signed in successfully!");
						}
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				username: z.string().email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				remember: z.boolean(),
			}),
		},
	});

	const handleTwoFactorVerify = async (e: React.FormEvent) => {
		e.preventDefault();
		setTwoFactorError(null);

		if (twoFactorCode.length !== 6) {
			setTwoFactorError("Please enter a valid 6-digit code");
			return;
		}

		setVerifying(true);

		try {
			const { data, error } = await authClient.twoFactor.verifyTotp({
				code: twoFactorCode,
				trustDevice: trustDevice,
			});

			if (error) {
				setTwoFactorError(error.message || "Invalid verification code");
			} else if (data) {
				toast.success("2FA verified successfully!");
				router.push("/dashboard");
			}
		} catch (error) {
			setTwoFactorError(error instanceof Error ? error.message : "Failed to verify code");
		} finally {
			setVerifying(false);
		}
	};

	const handleVerifyBackupCode = async (e: React.FormEvent) => {
		e.preventDefault();
		setTwoFactorError(null);

		if (backupCode.length !== 10) {
			setTwoFactorError("Please enter a valid 10-character backup code");
			return;
		}

		setVerifying(true);

		try {
			const { data, error } = await authClient.twoFactor.verifyBackupCode({
				code: backupCode,
				trustDevice: trustDevice,
			});

			if (error) {
				setTwoFactorError(error.message || "Invalid backup code");
			} else if (data) {
				toast.success("Backup code verified successfully!");
				router.push("/dashboard");
			}
		} catch (error) {
			setTwoFactorError(error instanceof Error ? error.message : "Failed to verify backup code");
		} finally {
			setVerifying(false);
		}
	};

	if (isPending) return <Loader />;

	// Show Backup Code verification screen
	if (showTwoFactor && showBackupCodeInput) {
		return (
			<div className="w-full mx-auto mt-8 md:mt-0 text-gray-900 dark:text-white transition-colors duration-300">
				{/* Logo and Heading */}
				<div className="flex flex-col items-center text-center mb-8">
					<Image
										src="/web_logo.svg"
										alt="KryptVault Logo"
										width={70}
										height={70}
										className="mb-3"
									/>
					<h1 className="text-3xl md:text-2xl font-bold mb-3">
						Use Backup Code
					</h1>
					<p className="text-gray-600 dark:text-gray-400 text-base max-w-md">
						Enter one of your 10-character backup codes to complete sign in
					</p>
				</div>

				{/* Backup Code Verification Form */}
				<form
					onSubmit={handleVerifyBackupCode}
					className="space-y-6 w-full max-w-md mx-auto px-1 my-auto"
				>
					{/* Error Alert */}
					{twoFactorError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{twoFactorError}</AlertDescription>
						</Alert>
					)}

					{/* Backup Code Input */}
					<div className="flex flex-col items-center space-y-4">

						<InputOTP
							maxLength={10}
							value={backupCode}
							onChange={(value) => setBackupCode(value)}
							disabled={verifying}
						>
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
								<InputOTPSlot index={5} />
								<InputOTPSlot index={6} />
								<InputOTPSlot index={7} />
								<InputOTPSlot index={8} />
								<InputOTPSlot index={9} />
							</InputOTPGroup>
						</InputOTP>

					</div>


					{/* Verify Button */}
					<Button
						type="submit"
						className="h-14 w-full text-xl font-bold rounded-lg transition"
						disabled={backupCode.length !== 10 || verifying}
					>
						{verifying ? "Verifying..." : "Verify Backup Code"}
					</Button>

					{/* Back Options */}
					<div className="space-y-3">
						<div className="flex items-center my-3">
							<div className="grow border-t border-neutral-300 dark:border-neutral-700"></div>
							<span className="mx-4 text-gray-500 dark:text-neutral-400 text-sm">
								or
							</span>
							<div className="grow border-t border-neutral-300 dark:border-neutral-700"></div>
						</div>

						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setShowBackupCodeInput(false);
								setBackupCode("");
								setTwoFactorError(null);
							}}
							className="w-full h-12 text-base font-semibold rounded-lg"
							disabled={verifying}
						>
							Use Authenticator Code
						</Button>

						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setShowTwoFactor(false);
								setShowBackupCodeInput(false);
								setTwoFactorCode("");
								setBackupCode("");
								setTwoFactorError(null);
								setTrustDevice(false);
							}}
							className="w-full h-12 text-base font-semibold rounded-lg"
							disabled={verifying}
						>
							Back to Sign In
						</Button>
					</div>
				</form>
			</div>
		);
	}

	// Show 2FA TOTP verification screen
	if (showTwoFactor) {
		return (
			<div className="w-full mx-auto mt-8 md:mt-0 text-gray-900 dark:text-white transition-colors duration-300">
				{/* Logo and Heading */}
				<div className="flex flex-col items-center text-center mb-8">
					<Image
															src="/web_logo.svg"
															alt="KryptVault Logo"
															width={70}
															height={70}
															className="mb-3"
														/>
					<h1 className="text-xl md:text-2xl font-bold mb-3">
						Two-Factor Authentication
					</h1>
					<p className="text-gray-600 dark:text-gray-400 text-base max-w-md">
						Enter the 6-digit code from your authenticator app to complete sign in
					</p>
				</div>

				{/* 2FA Verification Form */}
				<form
					onSubmit={handleTwoFactorVerify}
					className="space-y-6 w-full max-w-md mx-auto px-1 my-auto"
				>
					{/* Error Alert */}
					{twoFactorError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{twoFactorError}</AlertDescription>
						</Alert>
					)}

					{/* 2FA Code Input */}
					<div className="flex flex-col items-center space-y-4">

						<InputOTP
							maxLength={6}
							value={twoFactorCode}
							onChange={(value) => setTwoFactorCode(value)}
							disabled={verifying}
						>
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
								<InputOTPSlot index={5} />
							</InputOTPGroup>
						</InputOTP>

					</div>



					{/* Verify Button */}
					<Button
						type="submit"
						className="h-14 w-full text-xl font-bold rounded-lg transition"
						disabled={twoFactorCode.length !== 6 || verifying}
					>
						{verifying ? "Verifying..." : "Verify Code"}
					</Button>

					{/* Backup Options */}
					<div className="space-y-3">
						<div className="flex items-center my-3">
							<div className="grow border-t border-gray-300 dark:border-gray-700"></div>
							<span className="mx-4 text-gray-500 dark:text-gray-400 text-sm">
								Having trouble?
							</span>
							<div className="grow border-t border-gray-300 dark:border-gray-700"></div>
						</div>

						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setShowBackupCodeInput(true);
								setTwoFactorCode("");
								setTwoFactorError(null);
							}}
							className="w-full h-12 text-base font-semibold rounded-lg"
							disabled={verifying}
						>
							Use Backup Code
						</Button>

						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setShowTwoFactor(false);
								setShowBackupCodeInput(false);
								setTwoFactorCode("");
								setBackupCode("");
								setTwoFactorError(null);
								setTrustDevice(false);
							}}
							className="w-full h-12 text-base font-semibold rounded-lg"
							disabled={verifying}
						>
							Back to Sign In
						</Button>
					</div>
				</form>
			</div>
		);
	}

	// Show regular sign-in form
	return (
		<div className="w-full mx-auto mt-8 md:mt-0 text-gray-900 dark:text-white transition-colors duration-300">
			{/* Logo and Heading */}
			<div className="flex flex-col items-center text-center mb-8">
				<Image
					src="/web_logo.svg"
					alt="KryptVault Logo"
					width={70}
					height={70}
					className="mb-3"
				/>
				<h1 className="md:text-4xl font-bold mb-5 whitespace-nowrap">
					Welcome to KryptVault
				</h1>
				<p className="text-gray-600 dark:text-gray-400 text-lg">
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
				className="space-y-6 w-full max-w-md mx-auto px-1 my-auto"
			>
				{/* Username / Email */}
				<form.Field name="username">
					{(field) => (
						<div>
							<Label
								htmlFor={field.name}
								className="text-xl font-medium mb-1 block"
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
								className="h-14 rounded-lg md:text-lg px-4"
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
								className="text-xl font-medium mb-1 block"
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
								className="h-14 rounded-lg md:text-lg px-4"
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
							onChange={(e) => form.setFieldValue("remember", (e.target as HTMLInputElement).checked)}
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
						<div className="relative w-full">
							<Button
								type="submit"
								className="h-14 w-full text-2xl font-bold rounded-lg transition"
								disabled={!state.canSubmit || state.isSubmitting}
							>
								{state.isSubmitting ? "Signing in..." : "Sign In"}
							</Button>
							{lastMethod === "email" && (
								<Badge className="absolute -top-3 -right-3 bg-indigo-700 text-white">LAST</Badge>
							)}
						</div>
					)}
				</form.Subscribe>

				{/* Divider */}
				<div className="flex items-center my-3">
					<div className="grow border-t border-gray-300 dark:border-gray-700"></div>
					<span className="mx-4 text-gray-500 dark:text-gray-400 text-sm">
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
						className="h-14 mt-2 -mb-2 w-full text-base font-semibold rounded-xl"
					>
						<Fingerprint />
						Passkey
					</Button>
					{lastMethod === "passkey" && (
						<Badge className="absolute -top-3 -right-3 bg-indigo-700 text-white">
							LAST
						</Badge>
					)}
				</div>

				{/* Sign in with Google */}
				<div className="relative w-full">
					<Button
						type="button"
						onClick={async () => {
							const { data, error } = await authClient.signIn.social({
								provider: "google",
							});

							if (error) {
								toast.error(error.message);
							} else if (data) {
								router.push(data.url);
							}
						}}
						variant={"outline"}
						className="h-14 w-full text-base font-semibold rounded-xl"
					>
						<GoogleIcon className="w-6 h-6 mr-2" />
						Google
					</Button>
					{lastMethod === "google" && (
						<Badge className="absolute -top-3 -right-3 bg-indigo-700 text-white">
							LAST
						</Badge>
					)}
				</div>
			</form>
		</div>
	);
}
