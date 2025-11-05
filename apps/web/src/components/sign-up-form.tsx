"use client";

import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const router = useRouter();
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
						router.push("/dashboard");
						toast.success("Sign up successful!");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.string().email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) return <Loader />;

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
				<h1 className="md:text-4xl font-bold mb-5 whitespace-nowrap">Welcome to KryptVault</h1>
				<p className="text-gray-600 dark:text-gray-400 text-lg">
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
				className="space-y-6 w-full max-w-md mx-auto px-1 my-auto"
			>
				{/* Name */}
				<form.Field name="name">
					{(field) => (
						<div>
							<Label htmlFor={field.name} className="text-1xl font-medium mb-1 block">
								Name
							</Label>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="h-14 rounded-xxl md:text-lg px-4 border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-white/10 backdrop-blur-md focus:border-indigo-500 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
								placeholder="Ayush Kumar Anand"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-red-500 dark:text-red-400 text-sm mt-1">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				{/* Email */}
				<form.Field name="email">
					{(field) => (
						<div>
							<Label htmlFor={field.name} className="text-1xl font-medium mb-1 block">
								Email
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="h-14 rounded-xxl md:text-lg px-4 border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-white/10 backdrop-blur-md focus:border-indigo-500 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
								placeholder="you@example.com"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-red-500 dark:text-red-400 text-sm mt-1">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				{/* Password */}
				<form.Field name="password">
					{(field) => (
						<div>
							<Label htmlFor={field.name} className="text-1xl font-medium mb-1 block">
								Password
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="h-14 rounded-xxl md:text-lg px-4 border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-white/10 backdrop-blur-md focus:border-indigo-500 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
								placeholder="••••••••"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-red-500 dark:text-red-400 text-sm mt-1">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				{/* Confirm Password */}
				<form.Field name="confirmPassword">
					{(field) => (
						<div>
							<Label htmlFor={field.name} className="text-1xl font-medium mb-1 block">
								Confirm Password
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="h-14 rounded-lg md:text-lg px-4 border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-white/10 backdrop-blur-md focus:border-indigo-500 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
								placeholder="••••••••"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-red-500 dark:text-red-400 text-sm mt-1">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				{/* Remember Me + Submit */}
				<div className="flex flex-col gap-3">
					{/* Remember me */}
					<div className="flex items-center space-x-2">
						<input
							type="checkbox"
							id="remember"
							className="w-8 h-4 accent-indigo-500 rounded cursor-pointer"
							onChange={(e) => form.setFieldValue("remember", e.target.checked)}
						/>
						<Label htmlFor="remember" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
							Remember me
						</Label>
					</div>

					{/* Submit */}
					<form.Subscribe>
						{(state) => (
							<Button
								type="submit"
								className="h-14 w-full text-2xl font-bold rounded-xl transition"
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
