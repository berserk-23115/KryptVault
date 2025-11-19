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
  Upload,
  ChevronDown,
  File,
  FolderUp,
  FolderPlus,
  Plus,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";
import { filesApi } from "@/lib/files-api";
import { createFolder, addFileToFolder, type CreateFolderRequest } from "@/lib/folders-api";
import { encryptAndUploadFile, generateFolderKey, wrapDekWithFolderKey, unwrapSharedDek } from "@/lib/tauri-crypto";
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
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
        variant={isActive ? "default" : "ghost"}
        className="w-full justify-start gap-3 px-3 py-2 h-9"
      >
        <Icon size={20} />
        <span className="text-sm font-medium">{label}</span>
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

  const handleFileUpload = async () => {
    try {
      // Open file picker dialog for multiple files
      const selected = await open({
        multiple: true,
        title: "Select files to encrypt and upload",
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const toastId = toast.loading(`Uploading ${filePaths.length} file(s)...`);

      try {
        // Get user's public key for wrapping DEK
        const userKeysStr = localStorage.getItem("userKeypair");
        if (!userKeysStr) {
          throw new Error("You need to set up encryption keys first. Please generate your keypair.");
        }

        const userKeys = JSON.parse(userKeysStr);
        const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
        
        if (!userPublicKey) {
          throw new Error("Invalid keypair data. Please regenerate your encryption keys.");
        }

        // Upload each file
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          const filename = filePath.split("/").pop() || filePath.split("\\").pop() || "unknown";
          
          toast.loading(`Uploading ${filename} (${i + 1}/${filePaths.length})...`, { id: toastId });

          // Get file info
          const fileSize = 0; // Will be updated from encryption result

          // Initialize upload on server
          const initResponse = await filesApi.initUpload(
            filename,
            fileSize || 1,
            ""
          );

          // Encrypt and upload using Tauri
          const uploadResponse = await encryptAndUploadFile({
            file_path: filePath,
            server_public_key: userPublicKey,
            presigned_url: initResponse.presignedUrl,
            file_key: initResponse.s3Key,
          });

          // Complete upload on server
          await filesApi.completeUpload({
            fileId: initResponse.fileId,
            s3Key: uploadResponse.file_key,
            wrappedDek: uploadResponse.wrapped_dek,
            nonce: uploadResponse.nonce,
            originalFilename: uploadResponse.original_filename,
            fileSize: uploadResponse.file_size,
          });
        }

        toast.success(`Successfully uploaded ${filePaths.length} file(s)!`, { id: toastId });
        
        // Refresh the page data if needed
        window.location.reload();
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
      }
    } catch (err) {
      console.error("File selection error:", err);
    }
  };

  const handleFolderUpload = async () => {
    try {
      // Open file picker dialog for multiple files
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

  const handleStartFolderUpload = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    setShowFolderDialog(false);
    setUploading(true);

    const toastId = toast.loading(`Creating folder "${folderName}"...`);

    try {
      // Get user's keypair
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("You need to set up encryption keys first.");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      // Generate folder encryption key
      const folderKeyBase64 = await generateFolderKey();

      // Wrap folder key with user's public key using sealed box
      const wrappedFolderKey = await invoke<string>("seal_data", {
        data: folderKeyBase64,
        recipientPublicKey: userPublicKey,
      });

      // Create folder on server
      const createFolderRequest: CreateFolderRequest = {
        name: folderName,
        description: `Uploaded folder with ${selectedFiles.length} file(s)`,
        wrappedFolderKey: wrappedFolderKey,
      };

      const { folderId } = await createFolder(createFolderRequest);

      toast.loading(`Uploading ${selectedFiles.length} files...`, { id: toastId });

      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const filePath = selectedFiles[i];
        const filename = filePath.split("/").pop() || filePath.split("\\").pop() || "unknown";

        toast.loading(`Uploading ${filename} (${i + 1}/${selectedFiles.length})...`, { id: toastId });

        // Initialize file upload
        const initResponse = await filesApi.initUpload(filename, 1, "");

        // Encrypt with user's public key
        const encryptResult = await encryptAndUploadFile({
          file_path: filePath,
          server_public_key: userPublicKey,
          presigned_url: initResponse.presignedUrl,
          file_key: initResponse.s3Key,
        });

        // Complete file upload
        await filesApi.completeUpload({
          fileId: initResponse.fileId,
          s3Key: encryptResult.file_key,
          wrappedDek: encryptResult.wrapped_dek,
          nonce: encryptResult.nonce,
          originalFilename: encryptResult.original_filename,
          fileSize: encryptResult.file_size,
        });

        // Unwrap the DEK (it's wrapped with user's key)
        const unwrappedDek = await unwrapSharedDek(
          encryptResult.wrapped_dek,
          userPublicKey,
          userPrivateKey
        );

        // Wrap it with the folder key
        const wrappedDekForFolder = await wrapDekWithFolderKey({
          dek_b64: unwrappedDek,
          folder_key_b64: folderKeyBase64,
        });

        // Add file to folder
        await addFileToFolder({
          fileId: initResponse.fileId,
          folderId,
          wrappedDek: wrappedDekForFolder.wrapped_dek,
          wrappingNonce: wrappedDekForFolder.wrapping_nonce,
        });
      }

      toast.success(`Folder "${folderName}" created with ${selectedFiles.length} files!`, { id: toastId });
      setUploading(false);
      
      // Refresh the page
      window.location.reload();
    } catch (err) {
      console.error("Folder upload error:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
      setUploading(false);
    }
  };

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
              <img
                src="/web_logo.svg"
                alt="KryptVault Logo"
                width={30}
                height={30}
                className="invert dark:invert-0"
              />
              <h1 className="text-xl font-bold hidden sm:block">Krypt Vault</h1>
            </div>
          </div>

          {/* Search */}
          <ButtonGroup>
            <Input placeholder="Search..." className="w-lg"/>
            <Button variant="outline" aria-label="Search">
              <SearchIcon />
            </Button>
          </ButtonGroup>

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
            {/* Upload Button Group */}
            <ButtonGroup className="w-full">
              <Button 
                variant="default" 
                className="flex-1 gap-2"
                onClick={handleFileUpload}
              >
                <Plus className="h-4 w-4" />
                Upload
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="pl-2! pr-2!">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleFileUpload}>
                      <File className="h-4 w-4" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleFolderUpload}>
                      <FolderUp className="h-4 w-4" />
                      Upload Folder
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>

            {/* Menu */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3">
                Menu
              </h2>
              <div className="space-y-2">
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
                  icon={FileQuestion}
                  label="Requests"
                  to="/dashboard/requests"
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
          <div className="border-t border-border p-5 space-y-2">
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

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Folder Name Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the folder containing {selectedFiles.length} file(s)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              disabled={uploading}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFolderDialog(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleStartFolderUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
