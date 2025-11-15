import React from "react";
import {
  Home,
  Folder,
  Share2,
  FileQuestion,
  Trash2,
  Settings,
  HelpCircle,
  Menu,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type SidebarItemProps = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  isActive?: boolean;
};

function SidebarItem({ icon: Icon, label, isActive = false }: SidebarItemProps) {
  return (
    <Button
      variant={isActive ? "default" : "ghost"}
      className="w-full justify-start gap-3 px-3 py-2 h-9"
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          {/* Logo and Toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-3">
              <img src="/web_logo.svg" alt="KryptVault Logo" width={30} height={30} />
              <h1 className="text-xl font-bold hidden sm:block">Krypt Vault</h1>
            </div>
          </div>

          {/* Search */}
          <div className="hidden md:block flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search..."
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <ModeToggle />
            <Separator orientation="vertical" className="h-6" />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-300 ease-in-out overflow-hidden
          border-r border-border 
          bg-card
          flex flex-col`}
        >
          <nav className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Menu */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3">
                Menu
              </h2>
              <div className="space-y-2">
                <SidebarItem icon={Home} label="Dashboard" isActive />
                <SidebarItem icon={Folder} label="My Files" />
                <SidebarItem icon={Share2} label="Shared" />
                <SidebarItem icon={FileQuestion} label="Requests" />
                <SidebarItem icon={Trash2} label="Trash Bin" />
              </div>
            </div>
          </nav>

          {/* Bottom Menu */}
          <div className="border-t border-border p-5 space-y-2">
            <SidebarItem icon={Settings} label="Settings" />
            <SidebarItem icon={HelpCircle} label="Help & Guide" />
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
