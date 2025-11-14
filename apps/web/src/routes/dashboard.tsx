// src/routes/dashboard.tsx
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import LayoutShell from "@/components/mainlayout";
import React from "react";

export type FileItem = {
  id: string;
  name: string;
  previewUrl: string;
  team: string;
  editors: string[];
};

export type FolderItem = {
  id: string;
  name: string;
  team: string;
};

// ------------------- DUMMY FETCH (replace with API/db) -------------------
async function fetchDashboardData(): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
  return {
    files: [
      {
        id: "1",
        name: "Invoice.pdf",
        previewUrl: "/preview_1.png",
        team: "Team Krypt",
        editors: ["/profile.png", "/profile.png", "/profile.png"],
      },
      {
        id: "2",
        name: "Design.png",
        previewUrl: "/preview_2.png",
        team: "Design Team",
        editors: ["/profile.png"],
      },
      {
        id: "3",
        name: "Report.docx",
        previewUrl: "/preview_3.png",
        team: "Docs Team",
        editors: ["/profile.png", "/profile.png"],
      },
      {
        id: "4",
        name: "Notes.txt",
        previewUrl: "/preview_4.png",
        team: "Writers",
        editors: ["/profile.png", "/profile.png", "/profile.png", "/profile.png"],
      },
    ],
    folders: [
      { id: "1", name: "Finance", team: "Team Krypt" },
      { id: "2", name: "Designs", team: "Design Team" },
      { id: "3", name: "Documents", team: "Docs Team" },
      { id: "4", name: "Screenshots", team: "Media Team" },
      { id: "5", name: "Confidential", team: "Admin" },
      { id: "6", name: "Notes", team: "Writers" },
    ],
  };
}
// -----------------------------------------------------------------------

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const userName = session.data?.user?.name ?? "User";

  const [data, setData] = React.useState<{ files: FileItem[]; folders: FolderItem[] } | null>(null);

  React.useEffect(() => {
    fetchDashboardData().then((res) => setData(res));
  }, []);

  if (!data) return <div className="text-center p-10">Loading...</div>;

  return (
    <>
      <LayoutShell userName={userName} />
      <DashboardUI files={data.files} folders={data.folders} />
    </>
  );
}

// --------------------------------- UI ---------------------------------

function DashboardUI({
  files,
  folders,
}: {
  files: FileItem[];
  folders: FolderItem[];
}) {
  return (
    <main className="pt-[7.5rem] pl-[calc(64px+15.5rem)] pr-6 pb-6">

      {/* ---------------- STORAGE ---------------- */}
      <div className="w-full rounded-xl p-6 shadow-lg border 
        border-gray-300 dark:border-gray-700 
        bg-white/50 dark:bg-white/10 backdrop-blur-xl">

        <h2 className="text-xl font-semibold mb-4">Storage</h2>

        <div className="w-full h-4 rounded-full overflow-hidden flex">
          <div className="bg-blue-500" style={{ width: "10%" }} />
          <div className="bg-red-500" style={{ width: "20%" }} />
          <div className="bg-green-500" style={{ width: "15%" }} />
          <div className="bg-yellow-500" style={{ width: "55%" }} />
        </div>

        <div className="flex gap-8 mt-4 text-sm">
          <Legend color="bg-blue-500" label="Images (10%)" />
          <Legend color="bg-red-500" label="Videos (20%)" />
          <Legend color="bg-green-500" label="Documents (15%)" />
          <Legend color="bg-yellow-500" label="Others (55%)" />
        </div>
      </div>

      {/* ---------------- FILES ---------------- */}
      <section className="mt-6">
        <div className="p-6 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-purple-900/20 backdrop-blur-xl">

          <h2 className="text-2xl font-bold mb-4">Recent Files</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {files.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>

          {/* ---------------- FOLDERS ---------------- */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Recent Folders</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          </section>

        </div>
      </section>
    </main>
  );
}

// ---------------- REUSABLE COMPONENTS ----------------

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-sm ${color}`}></span>
      {label}
    </div>
  );
}

function FileCard({ file }: { file: FileItem }) {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-md border 
      border-gray-300 dark:border-gray-700 
      bg-white dark:bg-purple-900/20 
      hover:scale-[1.02] transition cursor-pointer"
    >
      <div className="h-36 w-full overflow-hidden">
        <img
          src={file.previewUrl}
          alt="File preview"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {file.name}
          </p>

          <div className="flex items-center -space-x-2 ml-3">
            {file.editors.slice(0, 2).map((avatar, idx) => (
              <img
                key={idx}
                src={avatar}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-purple-900"
              />
            ))}
            {file.editors.length > 2 && (
              <div
                className="w-8 h-8 rounded-full bg-purple-700 text-white text-xs 
                flex items-center justify-center border-2 border-white dark:border-purple-900"
              >
                +{file.editors.length - 2}
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {file.team}
        </p>
      </div>
    </div>
  );
}

function FolderCard({ folder }: { folder: FolderItem }) {
  return (
    <div
      className="flex items-center gap-4 p-5 rounded-xl 
      border border-gray-300 dark:border-gray-700 
      bg-black/10 dark:bg-purple-900/20 
      hover:scale-[1.02] transition shadow-md cursor-pointer"
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-purple-500 dark:text-purple-400 drop-shadow-lg"
      >
        <path d="M3 5a2 2 0 0 1 2-2h4.5a1 1 0 0 1 .8.4l1.4 1.8H19a2 2 0 0 1 2 2v1H3V5z" />
        <path d="M3 9h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      </svg>

      <div className="flex flex-col">
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {folder.name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {folder.team}
        </p>
      </div>
    </div>
  );
}
