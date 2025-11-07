"use client";
import { PrivacyTab } from "@/components/settings/privacy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

export default function Dashboard() {
  const { data: session } = authClient.useSession();
	return (
		<div>
			<h1>Settings</h1>
			<div>Manage your account settings and preferences.</div>
			<Tabs defaultValue="account">
				<TabsList className="w-full">
					<TabsTrigger value="details">My Details</TabsTrigger>
					<TabsTrigger value="notifications">Notifications</TabsTrigger>
					<TabsTrigger value="plans">Plans</TabsTrigger>
					<TabsTrigger value="blocked-users">Blocked Users</TabsTrigger>
					<TabsTrigger value="privacy">Privacy & Security</TabsTrigger>
					<TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
				</TabsList>
				<TabsContent value="details"></TabsContent>
				<TabsContent value="notifications"></TabsContent>
				<TabsContent value="plans"></TabsContent>
				<TabsContent value="blocked-users"></TabsContent>
				<TabsContent value="privacy">
					<PrivacyTab/>
				</TabsContent>
				<TabsContent value="advanced"></TabsContent>
			</Tabs>
		</div>
	);
}
