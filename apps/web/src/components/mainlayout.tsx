import React from "react";
import {
  Home,
  Folder,
  Share2,
  FileQuestion,
  Trash2,
  Settings,
  HelpCircle,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

type SidebarItemProps = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
};

function SidebarItem({ icon: Icon, label }: SidebarItemProps) {
  return (
    <button
      className="flex items-center gap-3 px-3 py-2 rounded-lg 
        text-gray-700 dark:text-gray-300 
        hover:bg-gray-200 dark:hover:bg-gray-800 
        transition w-full"
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function LayoutShell({ userName = "User" }: { userName?: string }) {
  return (
    <>
      {/* FIXED SIDEBAR */}
      <div className="fixed left-0 top-24 bottom-6 w-64 
        bg-white dark:bg-black 
        border border-gray-300 dark:border-gray-800 
        rounded-lg shadow-xl flex flex-col overflow-hidden z-50"
      >
        <aside className="flex flex-col justify-between flex-1 p-5">
          
          {/* Menu */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-300">
              Menu
            </h2>

            <nav className="space-y-3">
              <SidebarItem icon={Home} label="Dashboard" />
              <SidebarItem icon={Folder} label="My Files" />
              <SidebarItem icon={Share2} label="Shared" />
              <SidebarItem icon={FileQuestion} label="Requests" />
              <SidebarItem icon={Trash2} label="Trash Bin" />
            </nav>
          </div>

          {/* Bottom */}
          <div className="space-y-3">
            <SidebarItem icon={Settings} label="Settings" />
            <SidebarItem icon={HelpCircle} label="Help & Guide" />
          </div>

        </aside>
      </div>

      {/* FIXED TOPBAR */}
      <header
        className="fixed left-6 right-6 top-6 h-16 
        bg-white dark:bg-black 
        border border-gray-300 dark:border-gray-800 
        rounded-lg shadow-xl 
        flex items-center px-8 z-50"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 text-gray-900 dark:text-gray-200 transition">
          <img src="/web_logo.svg" alt="KryptVault Logo" width={30} height={30} />
          <h1 className="text-xl font-bold">Krypt Vault</h1>
        </div>

        {/* Spacer to shift search slightly left */}
        <div className="flex-[0.2]" />

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search..."
            className="w-96 px-4 py-2 rounded-lg 
              bg-gray-100 dark:bg-[#1f1f1f] 
              text-gray-900 dark:text-gray-200 
              outline-none border border-gray-300 dark:border-gray-700"
          />
        </div>

        {/* Push everything else to right */}
        <div className="flex-1" />

        {/* Mode Toggle */}
        <div className="mr-6">
          <ModeToggle />
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <img src="/profile.png" className="w-10 h-10 rounded-full" />
          <span className="font-semibold text-gray-900 dark:text-gray-200">
            {userName}
          </span>
        </div>
      </header>
    </>
  );
}
