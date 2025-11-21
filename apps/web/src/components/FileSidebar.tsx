import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  FileIcon,
  DownloadIcon,
  TrashIcon,
  CalendarIcon,
  HardDriveIcon,
  UserIcon,
  Share2Icon,
  LayersIcon,
  InfoIcon,
} from "lucide-react";
import type { FileMetadata } from "@/lib/files-api";

interface FileSidebarProps {
  file: FileMetadata | null;
  onClose: () => void;
  onDownload?: (file: FileMetadata) => void;
  onDelete?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  ownerName?: string;
  showShareButton?: boolean;
  isSharedFile?: boolean;
  sharedByMe?: boolean;
  recipients?: Array<{
    userId: string;
    name: string;
    email: string;
    sharedAt: Date;
  }>;
}

export function FileSidebar({
  file,
  onClose,
  onDownload,
  onDelete,
  onShare,
  ownerName,
  showShareButton = true,
  isSharedFile = false,
  sharedByMe = false,
  recipients = [],
}: FileSidebarProps) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  if (!file) return null;

  const ext = file.originalFilename.split(".").pop()?.toUpperCase() || "FILE";
  const fileType = file.mimeType || `${ext} File`;

  return (
    <aside className="w-90 flex flex-col">
      <div className="p-6 flex flex-col h-full bg-white dark:bg-purple-900/10 rounded-xl border dark:border-white/20 shadow-[0_0_28px_rgba(168,85,247,0.3)]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4 min-w-0">
            <FileIcon className="h-8 w-8 text-purple-400" />
            <h2 className="text-lg font-semibold dark:text-white truncate">
              {file.originalFilename}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-neutral-500 hover:text-white bg-white/14 hover:bg-neutral-800 rounded-lg"
          >
            ✕
          </Button>
        </div>

        <p className="text-sm text-neutral-400 mb-4">
          {sharedByMe ? "Shared by you" : isSharedFile ? "Shared file" : "File details"}
        </p>

        <Separator className="bg-neutral-800 mb-6" />

        {/* DETAILS AREA */}
        <div className="space-y-6 flex-1 overflow-y-auto pr-1">
          
          {/* FILE SIZE */}
          <DetailBlock
            icon={<HardDriveIcon className="h-4 w-4 text-purple-400" />}
            label="Size"
            value={formatFileSize(file.fileSize)}
          />

          {/* <Separator className="bg-neutral-800" /> */}

          {/* FILE TYPE */}
          <DetailBlock
            icon={<LayersIcon className="h-4 w-4 text-purple-400" />}
            label="Type"
            value={fileType}
          />

          {/* <Separator className="bg-neutral-800" /> */}

          {/* EXTENSION */}
          <DetailBlock
            icon={<InfoIcon className="h-4 w-4 text-purple-400" />}
            label="Extension"
            value={ext}
          />

          {/* <Separator className="bg-neutral-800" /> */}

          {/* CREATED */}
          <DetailBlock
            icon={<CalendarIcon className="h-4 w-4 text-purple-400" />}
            label="Created"
            value={new Date(file.createdAt).toLocaleString()}
          />

          {/* <Separator className="bg-neutral-800" /> */}

          {/* OWNER / SHARED WITH */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold dark:text-neutral-400 mb-1">
              <UserIcon className="h-4 w-4 text-purple-400" />
              <span>{sharedByMe ? "Shared With" : isSharedFile ? "Shared By" : "Owner"}</span>
            </div>

            {/* SHARED BY ME → SHOW LIST OF PEOPLE */}
            {sharedByMe && recipients.length > 0 ? (
              <RecipientsList recipients={recipients} />
            ) : isSharedFile ? (
              <p className="text-lg font-medium dark:text-white">{ownerName || "Unknown"}</p>
            ) : (
              <p className="text-lg font-medium dark:text-white">{ownerName || "Unknown"}</p>
            )}
          </div>

          <Separator className="shadow-[0_0_52px_rgba(168,85,247,0.3)] " />

          {/* STATUS */}
          <div>
            <div className="text-sm dark:text-neutral-400 font-bold mb-2">Status</div>
            <div className="flex items-center gap-2 text-green-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
              </svg>
              <span className="text-sm">Encrypted</span>
            </div>
          </div>

          {/* SHARED WITH YOU INDICATOR */}
          {isSharedFile && (
            <>
              <Separator className="bg-neutral-800" />
              <div className="flex items-center gap-2 text-blue-400">
                <Share2Icon className="h-4 w-4" />
                <span className="text-sm">Shared with you</span>
              </div>
            </>
          )}
        </div>

        {/* ACTIONS */}
        <div className="space-y-2 pt-6 border-t border-neutral-800">
          {showShareButton && onShare && !isSharedFile && file.isOwner !== false && (
            <Button
              onClick={() => onShare(file)}
              variant="outline"
              className="w-full bg-neutral-900 border-neutral-700 text-white hover:bg-black/70 hover:text-white dark:hover:bg-neutral-800"
            >
              <Share2Icon className="h-4 w-4 mr-2" />
              Share File
            </Button>
          )}

          {/* DOWNLOAD */}
          {onDownload && (
            <Button
              onClick={() => onDownload(file)}
              className="w-full bg-gradient-to-r from-purple-400 to-blue-300 dark:bg-gradient-to-r dark:from-purple-800 dark:to-blue-900/90 hover:shadow-[0_0_10px_rgba(168,85,247,0.45),0_0_10px_rgba(59,130,246,0.45)] font-bold text-black dark:text-white"
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}

          {/* DELETE */}
          {onDelete && !isSharedFile && file.isOwner !== false && (
            <>
              <Button
                onClick={() => setIsDeleteOpen(true)}
                variant="destructive"
                className="w-full bg-red-500 dark:bg-red-800 hover:bg-red-900/80 text-white hover:shadow-[0_0_20px_rgba(200,0,0,0.5)]"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>

              <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm delete</DialogTitle>
                    <DialogDescription>
                      Delete "{file.originalFilename}"? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        onDelete(file);
                        setIsDeleteOpen(false);
                      }}
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/* SMALL COMPONENTS FOR CLEANER CODE */

function DetailBlock({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold dark:text-neutral-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-medium text-gray-600 dark:text-white">{value}</p>
    </div>
  );
}

function RecipientsList({ recipients }: { recipients: any[] }) {
  return (
    <div className="space-y-2">
      {recipients.map((r) => (
        <div
          key={r.userId}
          className="bg-neutral-900 rounded-lg p-2 border border-neutral-800"
        >
          <p className="font-medium text-white">{r.name}</p>
          <p className="text-xs text-neutral-400">{r.email}</p>
          <p className="text-xs text-neutral-500 mt-1">
            Shared on {new Date(r.sharedAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}
