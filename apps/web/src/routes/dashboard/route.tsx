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
  SearchIcon,
  File,
  FolderUp,
  Plus,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";
import { filesApi } from "@/lib/files-api";
import {
  createFolder,
  addFileToFolder,
  type CreateFolderRequest,
} from "@/lib/folders-api";
import {
  encryptAndUploadFile,
  generateFolderKey,
  wrapDekWithFolderKey,
  unwrapSharedDek,
} from "@/lib/tauri-crypto";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const uploadGlow =
  "border-2 shadow-[0_0_10px_rgba(168,85,247,0.1)]";

const darkGlow =
  "shadow-[0_0_25px_rgba(168,85,247,0.48),0_0_10px_rgba(56,189,248,0.40)] border border-purple-400/40";

const lightGlow =
  "shadow-[0_0_25px_rgba(168,85,247,0.48),0_0_10px_rgba(56,189,248,0.40)] border border-purple-400/40";

  type SidebarItemProps = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  to: string;
};

function SidebarItem({ icon: Icon, label, to }: SidebarItemProps) {
  const router = useRouterState();
  const isActive = router.location.pathname === to;

  return (
    <Link to={to} className="w-full">
      <Button
        variant="ghost"
        className={`w-full justify-start gap-3 px-3 py-2 h-10 rounded-lg transition-all duration-300 text-sm
          ${
            isActive
              ? `bg-gradient-to-r from-purple-400 via-fuchsia-0 to-indigo-300 dark:from-purple-900/50 dark:via-fuchsia-900/0 dark:to-indigo-600/50 dark:text-white dark:${darkGlow} ${lightGlow}`
              : "text-zinc-700 dark:text-zinc-200 hover:bg-purple-400/15 dark:hover:bg-white-600 hover:text-purple-900 dark:hover:text-purple-200"
          }
        `}
      >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </Button>
    </Link>
  );
}

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showFolderDialog, setShowFolderDialog] = React.useState(false);
  const [folderName, setFolderName] = React.useState("New Folder");
  const [selectedFiles, setSelectedFiles] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadingType, setUploadingType] = React.useState<
    "file" | "folder" | null
  >(null);
  const [newMenuOpen, setNewMenuOpen] = React.useState(false);

  // FILE UPLOAD (single/multi) – functionality same
  const handleFileUpload = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to encrypt and upload",
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];

      setUploading(true);
      setUploadingType("file");

      const toastId = toast.loading(`Uploading ${filePaths.length} file(s)...`);

      try {
        const userKeysStr = localStorage.getItem("userKeypair");
        if (!userKeysStr) {
          throw new Error(
            "You need to set up encryption keys first. Please generate your keypair."
          );
        }

        const userKeys = JSON.parse(userKeysStr);
        const userPublicKey =
          userKeys.x25519PublicKey || userKeys.x25519_public_key;

        if (!userPublicKey) {
          throw new Error(
            "Invalid keypair data. Please regenerate your encryption keys."
          );
        }

        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          const filename =
            filePath.split("/").pop() ||
            filePath.split("\\").pop() ||
            "unknown";

          toast.loading(
            `Uploading ${filename} (${i + 1}/${filePaths.length})...`,
            {
              id: toastId,
            }
          );

          // If you later want true size, compute it on backend/Tauri side.
          const fileSize = 0;

          const initResponse = await filesApi.initUpload(
            filename,
            fileSize || 1,
            ""
          );

          const uploadResponse = await encryptAndUploadFile({
            file_path: filePath,
            server_public_key: userPublicKey,
            presigned_url: initResponse.presignedUrl,
            file_key: initResponse.s3Key,
          });

          await filesApi.completeUpload({
            fileId: initResponse.fileId,
            s3Key: uploadResponse.file_key,
            wrappedDek: uploadResponse.wrapped_dek,
            nonce: uploadResponse.nonce,
            originalFilename: uploadResponse.original_filename,
            fileSize: uploadResponse.file_size,
          });
        }

        toast.success(`Successfully uploaded ${filePaths.length} file(s)!`, {
          id: toastId,
        });
        window.location.reload();
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(err instanceof Error ? err.message : "Upload failed", {
          id: toastId,
        });
      } finally {
        setUploading(false);
        setUploadingType(null);
      }
    } catch (err) {
      console.error("File selection error:", err);
    }
  };

  // FOLDER SELECTION – same logic
  const handleFolderUpload = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to upload to a new folder",
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      setSelectedFiles(filePaths);
      setFolderName("New Folder");
      setShowFolderDialog(true);
    } catch (err) {
      console.error("File selection error:", err);
      toast.error("Failed to select files");
    }
  };

  // FOLDER UPLOAD – same logic
  const handleStartFolderUpload = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    setShowFolderDialog(false);
    setUploading(true);
    setUploadingType("folder");

    const toastId = toast.loading(`Creating folder "${folderName}"...`);

    try {
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("You need to set up encryption keys first.");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey =
        userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey =
        userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      const folderKeyBase64 = await generateFolderKey();

      const wrappedFolderKey = await invoke<string>("seal_data", {
        data: folderKeyBase64,
        recipientPublicKey: userPublicKey,
      });

      const createFolderRequest: CreateFolderRequest = {
        name: folderName,
        description: `Uploaded folder with ${selectedFiles.length} file(s)`,
        wrappedFolderKey: wrappedFolderKey,
      };

      const { folderId } = await createFolder(createFolderRequest);

      toast.loading(`Uploading ${selectedFiles.length} files...`, {
        id: toastId,
      });

      for (let i = 0; i < selectedFiles.length; i++) {
        const filePath = selectedFiles[i];
        const filename =
          filePath.split("/").pop() ||
          filePath.split("\\").pop() ||
          "unknown";

        toast.loading(
          `Uploading ${filename} (${i + 1}/${selectedFiles.length})...`,
          {
            id: toastId,
          }
        );

        const initResponse = await filesApi.initUpload(filename, 1, "");

        const encryptResult = await encryptAndUploadFile({
          file_path: filePath,
          server_public_key: userPublicKey,
          presigned_url: initResponse.presignedUrl,
          file_key: initResponse.s3Key,
        });

        await filesApi.completeUpload({
          fileId: initResponse.fileId,
          s3Key: encryptResult.file_key,
          wrappedDek: encryptResult.wrapped_dek,
          nonce: encryptResult.nonce,
          originalFilename: encryptResult.original_filename,
          fileSize: encryptResult.file_size,
        });

        const unwrappedDek = await unwrapSharedDek(
          encryptResult.wrapped_dek,
          userPublicKey,
          userPrivateKey
        );

        const wrappedDekForFolder = await wrapDekWithFolderKey({
          dek_b64: unwrappedDek,
          folder_key_b64: folderKeyBase64,
        });

        await addFileToFolder({
          fileId: initResponse.fileId,
          folderId,
          wrappedDek: wrappedDekForFolder.wrapped_dek,
          wrappingNonce: wrappedDekForFolder.wrapping_nonce,
        });
      }

      toast.success(
        `Folder "${folderName}" created with ${selectedFiles.length} files!`,
        { id: toastId }
      );
      window.location.reload();
    } catch (err) {
      console.error("Folder upload error:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: toastId,
      });
    } finally {
      setUploading(false);
      setUploadingType(null);
    }
  };

  return (
    <div
      className="
        flex h-screen flex-col overflow-hidden relative
        bg-gradient-to-b from-slate-50 via-slate-100 to-white text-slate-900
        dark:from-[#020016] dark:via-slate-950 dark:to-black dark:text-slate-100
        transition-colors
      "
    >
      {/* Ambient gradient background blobs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {/* Light mode blobs */}
        <div className="absolute w-[520px] h-[520px] bg-purple-300/40 rounded-full blur-[150px] -left-40 top-24 dark:hidden" />
        <div className="absolute w-[480px] h-[480px] bg-fuchsia-300/35 rounded-full blur-[150px] -right-40 bottom-12 dark:hidden" />
        {/* Dark mode blobs */}
        <div className="absolute w-[520px] h-[520px] bg-purple-700/30 rounded-full blur-[160px] -left-40 top-16 hidden dark:block" />
        <div className="absolute w-[480px] h-[480px] bg-fuchsia-500/25 rounded-full blur-[150px] -right-40 bottom-16 hidden dark:block" />
        <div className="absolute w-[380px] h-[380px] bg-sky-400/15 rounded-full blur-[130px] left-1/2 -translate-x-1/2 top-[40%]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white dark:bg-black/35 backdrop-blur-2xl shadow-[0_0_1px_rgba(0,0,0,0.6)]">
        <div className="flex items-center px-6 py-3 gap-4">
          {/* Left: toggle + logo + search (search right after logo) */}
          <div className="flex items-center gap-8 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-md border border-white/20 bg-black/10 hover:bg-black/20 dark:hover:bg-white/10"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/web_logo.svg"
                alt="KryptVault Logo"
                width={28}
                height={28}
                className="invert dark:invert-0 drop-shadow-[0_0_1px_rgba(168,85,247,0.9)]"
              />
              <h1 className="text-lg font-semibold hidden sm:block tracking-tight dark:text-zinc-100">
                Krypt Vault
              </h1>
            </div>

            {/* Search bar immediately after logo, still flexible */}
            <div className="flex items-center w-full max-w-lg pl-3">
              <div className="flex h-10 w-full items-center gap-2 bg-white dark:bg-white/5 border border-purple-200 dark:border-purple-300/25 rounded-full px-3 py-1.5 backdrop-blur-xl shadow-[0_0_14px_rgba(124,58,237,0.45)] focus-within:border-purple-400/70 transition-all duration-300">
                <SearchIcon className="h-4 w-4 dark:text-purple-200/80" />
                <Input
                  placeholder="Search in Vault..."
                  className="w-full border-0 focus-visible:ring-0 focus-visible:outline-none text-xs sm:text-sm dark:placeholder:text-zinc-400 text-zinc-900 dark:placeholder:text-zinc-500 dark:text-zinc-100 dark:bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Right: Mode + User */}
          <div className="flex items-center gap-3">
            <ModeToggle />
            <Separator orientation="vertical" className="h-6 bg-white/15" />
            <UserMenu/>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-300 ease-in-out border-r border-slate-200/60 bg-white/70 dark:border-white/10 dark:bg-black/40 backdrop-blur-2xl flex flex-col shadow-[0_0_24px_rgba(148,163,184,0.55)] dark:shadow-[0_0_30px_rgba(15,23,42,0.95)]`}
        >
          <nav className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* New button with expanding panel */}
            <div className="px-1 pt-1">
              <div className="relative">
                <Button
                  variant="ghost"
                  onClick={() => setNewMenuOpen((prev) => !prev)}
                  className={`
                    w-full justify-between h-11 rounded-lg border text-md font-semibold
                    bg-gradient-to-r from-purple-500/15 via-fuchsia-500/25 to-indigo-500/20
                    ${newMenuOpen ? "text-slate-400 dark:text-zinc-500": "text-slate-800 dark:text-zinc-100"} 
                    border-purple-300/20 dark:border-purple-300/10
                    backdrop-blur-xl
                    transition-all duration-200
                    ${
                      newMenuOpen
                        ? uploadGlow + " rounded-b-none bg-gradient-to-r from-purple-500/10 via-fuchsia-500/15 to-indigo-500/10"
                        : "hover:border-purple-600/50 hover:shadow-[0_0_10px_rgba(168,85,247,0.45),0_0_10px_rgba(59,130,246,0.45)]"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    <span>Upload</span>
                  </div>
                  <span
                    className={`text-xs transition-transform duration-300 ${
                      newMenuOpen ? "rotate-90" : ""
                    }`}
                  >
                    ▸
                  </span>
                </Button>

                {/* Expanding file/folder options */}
                <div
                  className={`origin-top overflow-hidden transition-all duration-300 ${
                    newMenuOpen
                      ? "max-h-40 opacity-100 translate-y-0 shadow-[0_0_20px_rgba(168,85,247,0.18),0_0_30px_rgba(56,189,248,0.10)]"
                      : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                  }`}
                >
                  <div
                    className={`
                      space-y-2 border dark:border-purple-300/20 border-t-0
                      dark:bg-black backdrop-blur-2xl px-2.5 py-2
                      rounded-b-lg rounded-t-none shadow-[0_0_10px_rgba(168,85,247,0.18)]
                    `}
                  >
                    <Button
                      variant="ghost"
                      onClick={handleFileUpload}
                      disabled={uploading}
                      className={`
                        w-full justify-start h-9 rounded-lg text-xs sm:text-sm
                        bg-gradient-to-r from-purple-100/80 to-indigo-100/80
                        dark:from-purple-950/80 dark:to-indigo-800/50
                        text-slate-800 dark:text-slate-100
                        ${
                          uploadingType === "file"
                            ? uploadGlow
                            : "hover:border-purple-400/80 dark:hover:border-purple-300/80 hover:shadow-[0_0_14px_rgba(168,85,247,0.45)]"
                        }
                      `}
                    >
                      <File className="mr-2 h-4 w-4" />
                      File upload
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleFolderUpload}
                      disabled={uploading}
                      className={`
                        w-full justify-start h-9 rounded-lg text-xs sm:text-sm
                        bg-gradient-to-r from-purple-100/80 to-indigo-100/80
                        dark:from-purple-950/80 dark:to-indigo-800/50
                        text-slate-800 dark:text-slate-100
                        ${
                          uploadingType === "folder"
                            ? uploadGlow
                            : "hover:border-purple-400/80 dark:hover:border-purple-300/80 hover:shadow-[0_0_14px_rgba(168,85,247,0.45)]"
                        }
                      `}
                    >
                      <FolderUp className="mr-2 h-4 w-4" />
                      Folder upload
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-3">
              <div className="space-y-1">
                <SidebarItem icon={Home} label="Dashboard" to="/dashboard" />
                <SidebarItem
                  icon={Folder}
                  label="My Files"
                  to="/dashboard/my-files"
                />
                <SidebarItem
                  icon={Share2}
                  label="Shared"
                  to="/dashboard/shared"
                />
                <SidebarItem
                  icon={Trash2}
                  label="Trash Bin"
                  to="/dashboard/trash-bin"
                />
              </div>
            </div>
          </nav>

          {/* Bottom Menu */}
          <div className="border-t border-slate-200/70 dark:border-white/10 p-3 space-y-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl">
            <SidebarItem
              icon={Settings}
              label="Settings"
              to="/dashboard/settings"
            />
            <SidebarItem
              icon={HelpCircle}
              label="Help & Guide"
              to="/dashboard/help-guide"
            />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-white/40 via-slate-100/60 to-slate-200/60 dark:from-black/40 dark:via-black/60 dark:to-black/90 p-3 sm:p-4">
          <div
            className="
              h-full w-full rounded-2xl
              border border-slate-200/80 dark:border-white/10
              bg-white/80 dark:bg-black/45
              backdrop-blur-2xl
              shadow-[0_0_32px_rgba(148,163,184,0.6)]
              dark:shadow-[0_0_36px_rgba(15,23,42,0.95)]
              p-3 sm:p-4
            "
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Folder name dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent
          className="
            sm:max-w-md rounded-xl
            border border-purple-300/60 dark:border-purple-500/40
            bg-white/90 dark:bg-black/90
            backdrop-blur-2xl text-slate-900 dark:text-white
            shadow-[0_0_26px_rgba(168,85,247,0.55)]
          "
        >
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-zinc-300">
              Enter a name for the folder containing {selectedFiles.length} file
              (s).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              className="
                rounded-md
                bg-slate-100/80 dark:bg-black/60
                border border-purple-300/60 dark:border-purple-500/40
                text-slate-900 dark:text-zinc-100
                placeholder:text-slate-400 dark:placeholder:text-zinc-500
              "
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              disabled={uploading}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowFolderDialog(false)}
              disabled={uploading}
              className="
                rounded-md
                border border-slate-300 dark:border-zinc-600
                bg-white/70 dark:bg-black/60
                hover:bg-slate-100 dark:hover:bg-zinc-900
                text-slate-800 dark:text-zinc-100
              "
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartFolderUpload}
              disabled={uploading}
              className={`
                rounded-md px-4
                bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500
                hover:from-purple-500 hover:via-fuchsia-400 hover:to-indigo-400
                text-white
                ${uploadingType === "folder" ? uploadGlow : ""}
              `}
            >
              {uploading && uploadingType === "folder"
                ? "Uploading..."
                : "Create & Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RouteComponent;
