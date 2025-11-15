import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import Dither from "@/components/Dither";
import { ModeToggle } from "@/components/mode-toggle";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		const checkSession = async () => {
			try {
				const session = await authClient.getSession();
				if (session.data) {
					navigate({ to: "/dashboard" });
				}
			} catch (error) {
				console.error("Session check error:", error);
				// Continue to login page if session check fails
			}
		};
		
		checkSession();
	}, [navigate]);

	return (
		<div className="relative flex h-screen w-full overflow-hidden bg-black text-black dark:text-white">
			{/* Dither Background - Full Screen */}
			<div className="absolute inset-0 z-0">
				<Dither
					waveColor={[0.35, 0.0, 0.5]}
					disableAnimation={false}
					enableMouseInteraction={true}
					mouseRadius={0.2}
					colorNum={50}
					waveAmplitude={0.58}
					waveFrequency={1.8}
					waveSpeed={0.05}
				/>
			</div>

			
			<div className="relative z-10 m-auto flex w-full max-w-md flex-col rounded-3xl bg-white shadow-lg dark:bg-neutral-900 sm:p-12">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					) : (
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					)}
				
			</div>
		</div>
	);
}
