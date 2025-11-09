import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import Dither from "@/components/Dither";
import { ModeToggle } from "@/components/mode-toggle";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(false);

	return (
		<div className="relative flex min-h-screen w-full overflow-hidden bg-black text-black dark:text-white">
			<div className="absolute top-4 right-4 z-50">
				<ModeToggle />
			</div>

			<div className="relative w-[55%] md:block">
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

			<div className="w-full md:w-[60%] flex items-center justify-center p-8 bg-white dark:bg-black">
				<div className="max-w-md w-full">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					) : (
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					)}
				</div>
			</div>
		</div>
	);
}
