"use client";

import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	Copy,
	Loader2,
	Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";

export const PrivacyTab = () => {
	const { data: session } = authClient.useSession();
	const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [qrUri, setQrUri] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
	const [password, setPassword] = useState("");
	const [totpCode, setTotpCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [showManualEntry, setShowManualEntry] = useState(false);

	useEffect(() => {
		setTwoFactorEnabled(session?.user?.twoFactorEnabled ?? null);
	}, [session]);

	const copyToClipboard = (text: string, index: number) => {
		navigator.clipboard.writeText(text);
		setCopiedIndex(index);
		setTimeout(() => setCopiedIndex(null), 2000);
	};

	const getManualEntryDetails = () => {
		if (!qrUri) return null;
		try {
			const url = new URL(qrUri);
			const secret = url.searchParams.get("secret") || "";
			const issuer = url.searchParams.get("issuer") || "Krypt Vault";
			const accountName = url.pathname.split("/").pop() || "Your Account";
			return { secret, issuer, accountName };
		} catch {
			return null;
		}
	};

	const handleToggle = async (isEnabled: boolean) => {
		if (isEnabled) {
			// Toggling ON - show password form
			setShowPasswordForm(true);
			setError(null);
			setSuccessMessage(null);
		} else {
			// Toggling OFF - disable 2FA directly
			setError(null);
			setSuccessMessage(null);
			setShowPasswordForm(true);
		}
	};

	const handleEnable = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccessMessage(null);
		setLoading(true);
		try {
			const res = await authClient.twoFactor.enable({ password });
			if (res.data) {
				setQrUri(res.data.totpURI);
				setBackupCodes(res.data.backupCodes);
			}
			setPassword("");
			setSuccessMessage(
				"QR Code generated successfully. Scan with your authenticator app.",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to enable 2FA");
			setShowPasswordForm(false);
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyTotp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccessMessage(null);
		setLoading(true);
		try {
			await authClient.twoFactor.verifyTotp({
				code: totpCode,
				trustDevice: true,
			});
			setTwoFactorEnabled(true);
			setQrUri(null);
			setTotpCode("");
			setPassword("");
			setShowPasswordForm(false);
			setSuccessMessage(
				"Two-factor authentication has been enabled successfully.",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid code");
		} finally {
			setLoading(false);
		}
	};

	const handleDisable = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccessMessage(null);
		setLoading(true);
		try {
			await authClient.twoFactor.disable({ password });
			setTwoFactorEnabled(false);
			setQrUri(null);
			setBackupCodes(null);
			setPassword("");
			setShowPasswordForm(false);
			setSuccessMessage("Two-factor authentication has been disabled.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to disable 2FA");
		} finally {
			setLoading(false);
		}
	};

	if (twoFactorEnabled === null) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-muted-foreground">
						Loading authentication settings...
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Lock className="h-5 w-5 text-primary" />
							<div>
								<CardTitle>Two-Factor Authentication</CardTitle>
							</div>
						</div>
						<Switch
							checked={twoFactorEnabled}
							onCheckedChange={handleToggle}
							disabled={loading || showPasswordForm}
						/>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Error Alert */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Success Alert */}
					{successMessage && (
						<Alert variant="default">
							<CheckCircle2 className="h-4 w-4" />
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>{successMessage}</AlertDescription>
						</Alert>
					)}

					{/* Password Form for Enable/Disable */}
					{showPasswordForm && (
						<>
							<Separator />

							{twoFactorEnabled ? (
								<form onSubmit={handleDisable} className="space-y-4">
									<div>
										<h3 className="text-sm font-semibold mb-3">
											Disable Two-Factor Authentication
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Disabling 2FA will reduce your account's security. Enter
											your password to confirm.
										</p>
									</div>

									<div className="space-y-3">
										<div>
											<Label htmlFor="disable-password">Password</Label>
											<Input
												id="disable-password"
												type="password"
												placeholder="Enter your password"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
												disabled={loading}
												className="mt-1"
												autoFocus
											/>
										</div>
										<div className="flex gap-2">
											<Button
												type="submit"
												disabled={loading || !password}
												variant="destructive"
											>
												{loading ? (
													<>
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
														Disabling...
													</>
												) : (
													"Confirm Disable"
												)}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													setShowPasswordForm(false);
													setPassword("");
													setError(null);
												}}
												disabled={loading}
											>
												Cancel
											</Button>
										</div>
									</div>
								</form>
							) : (
								<form onSubmit={handleEnable} className="space-y-4">
									<div>
										<h3 className="text-sm font-semibold mb-3">
											Enable Two-Factor Authentication
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Secure your account by requiring a second form of
											verification when signing in. Enter your password to
											continue.
										</p>
									</div>

									<div className="space-y-3">
										<div>
											<Label htmlFor="enable-password">Password</Label>
											<Input
												id="enable-password"
												type="password"
												placeholder="Enter your password"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
												disabled={loading}
												className="mt-1"
												autoFocus
											/>
										</div>
										<div className="flex gap-2">
											<Button type="submit" disabled={loading || !password}>
												{loading ? (
													<>
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
														Setting Up...
													</>
												) : (
													"Continue"
												)}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													setShowPasswordForm(false);
													setPassword("");
													setError(null);
												}}
												disabled={loading}
											>
												Cancel
											</Button>
										</div>
									</div>
								</form>
							)}
						</>
					)}

					{/* QR Code Section */}
					{qrUri && (
						<>
							<Separator />
							<div className="space-y-6">
								<div className="space-y-4">
									<div>
										<h3 className="text-sm font-semibold mb-3">Scan QR Code</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Use an authenticator app (Google Authenticator, Authy,
											Microsoft Authenticator, etc.) to scan this QR code.
										</p>
									</div>
									<div className="flex justify-center p-4 bg-muted/50 rounded-lg">
										<QRCode value={qrUri} size={200} level="H" />
									</div>
								</div>

								{/* Manual Entry Section */}
								<div className="border rounded-lg p-4 bg-muted/30">
									<button
										type="button"
										onClick={() => setShowManualEntry(!showManualEntry)}
										className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full"
									>
										<ChevronDown
											className={`h-4 w-4 transition-transform ${
												showManualEntry ? "rotate-180" : ""
											}`}
										/>
										Can't scan the QR code? Enter manually
									</button>

									{showManualEntry && getManualEntryDetails() && (
										<div className="mt-4 space-y-4 pt-4 border-t">
											<p className="text-sm text-muted-foreground">
												If you're having trouble scanning the QR code, you can
												enter the following details manually in your
												authenticator app:
											</p>

											<div className="space-y-3">
												<div>
													<Label className="text-xs font-semibold text-muted-foreground mb-1 block">
														Account Name
													</Label>
													<div className="flex items-center gap-2">
														<code className="flex-1 p-2 bg-background rounded text-sm font-mono border">
															{getManualEntryDetails()?.accountName}
														</code>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getManualEntryDetails()?.accountName || "",
																	-1,
																)
															}
															className="h-9 px-2"
														>
															<Copy className="h-4 w-4" />
														</Button>
													</div>
												</div>

												<div>
													<Label className="text-xs font-semibold text-muted-foreground mb-1 block">
														Issuer
													</Label>
													<div className="flex items-center gap-2">
														<code className="flex-1 p-2 bg-background rounded text-sm font-mono border">
															{getManualEntryDetails()?.issuer}
														</code>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getManualEntryDetails()?.issuer || "",
																	-2,
																)
															}
															className="h-9 px-2"
														>
															<Copy className="h-4 w-4" />
														</Button>
													</div>
												</div>

												<div>
													<div className="flex items-center justify-between mb-1">
														<Label className="text-xs font-semibold text-muted-foreground">
															Secret Key
														</Label>
													</div>
													<div className="flex items-center gap-2">
														<code className="flex-1 p-2 bg-background rounded text-sm font-mono border break-all">
															{getManualEntryDetails()?.secret}
														</code>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getManualEntryDetails()?.secret || "",
																	-3,
																)
															}
															className="h-9 px-2"
														>
															<Copy className="h-4 w-4" />
														</Button>
													</div>
													<p className="text-xs text-muted-foreground mt-2">
														Type or paste this key into your authenticator app
													</p>
												</div>

												<Alert variant="default" className="mt-3">
													<AlertCircle className="h-4 w-4" />
													<AlertTitle>Time-based Authentication</AlertTitle>
													<AlertDescription>
														Make sure to set the authentication type to
														"Time-based (TOTP)" in your authenticator app
													</AlertDescription>
												</Alert>
											</div>
										</div>
									)}
								</div>

								<Separator />

								<form onSubmit={handleVerifyTotp} className="space-y-4">
									<div className="flex flex-col items-center space-y-4">
										<Label htmlFor="totp-code">Verification Code</Label>
										<InputOTP
											maxLength={6}
											value={totpCode}
											onChange={(value) => setTotpCode(value)}
											disabled={loading}
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
										<p className="text-sm text-muted-foreground">
											Enter the 6-digit code from your authenticator app
										</p>
									</div>
									<Button
										type="submit"
										disabled={loading || totpCode.length !== 6}
										className="w-full"
									>
										{loading ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Verifying...
											</>
										) : (
											"Verify Code"
										)}
									</Button>
								</form>

								{backupCodes && (
									<>
										<Separator />

										<div className="space-y-4">
											<div>
												<h3 className="text-sm font-semibold mb-2">
													Backup Codes
												</h3>
												<p className="text-sm text-muted-foreground mb-3">
													Save these backup codes in a secure location. You can
													use them if you lose access to your authenticator app.
													Each code can only be used once.
												</p>
											</div>
											<Alert variant="default">
												<AlertCircle className="h-4 w-4" />
												<AlertTitle>Store These Codes Safely</AlertTitle>
												<AlertDescription>
													Write down or save these backup codes in a secure
													location. They are the only way to recover your
													account if you lose your authenticator app.
												</AlertDescription>
											</Alert>
											<div className="bg-muted/50 border rounded-lg p-4 space-y-2">
												{backupCodes.map((code, idx) => (
													<div
														key={code}
														className="flex items-center justify-between p-2 rounded hover:bg-background transition-colors group"
													>
														<code className="text-sm font-mono text-muted-foreground">
															{code}
														</code>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => copyToClipboard(code, idx)}
															className="opacity-0 group-hover:opacity-100 transition-opacity"
														>
															<Copy className="h-4 w-4" />
															{copiedIndex === idx && (
																<span className="ml-1 text-xs">Copied</span>
															)}
														</Button>
													</div>
												))}
											</div>
										</div>
									</>
								)}
							</div>
						</>
					)}

					{/* Backup Codes Management (when 2FA is enabled) */}
					{twoFactorEnabled && !qrUri && (
						<>
							<Separator />
							<div className="space-y-4">
								<div>
									<h3 className="text-sm font-semibold mb-2">Backup Codes</h3>
									<p className="text-sm text-muted-foreground mb-3">
										Regenerate your backup codes. Each code can be used once to
										access your account if you lose access to your authenticator
										app.
									</p>
								</div>

								{backupCodes && (
									<div className="bg-muted/50 border rounded-lg p-4 space-y-2 mb-4">
										<div className="space-y-2">
											{backupCodes.map((code, idx) => (
												<div
													key={code}
													className="flex items-center justify-between p-2 rounded hover:bg-background transition-colors group"
												>
													<code className="text-sm font-mono text-muted-foreground">
														{code}
													</code>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => copyToClipboard(code, idx)}
														className="opacity-0 group-hover:opacity-100 transition-opacity"
													>
														<Copy className="h-4 w-4" />
														{copiedIndex === idx && (
															<span className="ml-1 text-xs">Copied</span>
														)}
													</Button>
												</div>
											))}
										</div>
									</div>
								)}

								<Button
									onClick={() => {
										setShowPasswordForm(true);
									}}
									variant="outline"
									size="sm"
								>
									Regenerate Backup Codes
								</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
};
