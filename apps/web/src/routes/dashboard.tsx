import { authClient } from "@/lib/auth-client";
import { PasskeyManager } from "@/components/passkey-manager";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}
		return { session };
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	return (
		<div className="container mx-auto p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Dashboard</h1>
				<p className="text-muted-foreground">Welcome back, {session.data?.user.name}</p>
			</div>
			
			<div className="grid gap-8">
				<PasskeyManager />
			</div>
		</div>
	);
}
