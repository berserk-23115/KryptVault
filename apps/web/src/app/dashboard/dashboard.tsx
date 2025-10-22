"use client";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function Dashboard({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
	return <>
	<div className="grid grid-cols-5">
		<div className="col-span-1 border-r p-4">
			<h2 className="text-lg font-semibold mb-4">Sidebar</h2>
		</div>
		<div className="col-span-4 bg-white">
			<div className="p-6">
				<h1 className="text-2xl font-bold mb-4">Welcome to Your Dashboard</h1>
				<p className="mb-6">Manage your secure storage and file sharing settings here.</p>
		</div>
		</div>
	</div>
	
	</>;
}
