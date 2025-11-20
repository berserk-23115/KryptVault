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
  EyeIcon,
  XIcon,
  Share2Icon,
} from "lucide-react";
import type { FileMetadata } from "@/lib/files-api";

interface FileSidebarProps {
  file: FileMetadata | null;
  onClose: () => void;
  onPreview?: (file: FileMetadata) => void;
  onDownload?: (file: FileMetadata) => void;
  onDelete?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  ownerName?: string;
  showShareButton?: boolean;
  isSharedFile?: boolean;
  sharedByMe?: boolean; // New prop to indicate this is shown in "Shared By Me" section
  recipients?: Array<{ // Recipients for files shared by me
    userId: string;
    name: string;
    email: string;
    sharedAt: Date;
  }>;
}

export function FileSidebar({
  file,
  onClose,
  onPreview,
  onDownload,
  onDelete,
  onShare,
  ownerName,
  showShareButton = true,
  isSharedFile = false,
  sharedByMe = false,
  recipients,
}: FileSidebarProps) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  if (!file) return null;

  return (
    <aside className="w-96 border-l border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col overflow-y-auto">
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileIcon className="h-5 w-5 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
              {file.originalFilename}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0"
          >
            <span className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">✕</span>
          </Button>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          {sharedByMe ? "File shared by you" : isSharedFile ? "Shared file details and actions" : "File details and actions"}
        </p>

        {/* Preview Placeholder */}
        <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center mb-6">
          <FileIcon className="h-16 w-16 text-neutral-400" />
        </div>

        {/* File Info - Scrollable */}
        <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              <HardDriveIcon className="h-4 w-4" />
              <span>Size</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {formatFileSize(file.fileSize)}
            </p>
          </div>

          <Separator className="bg-neutral-300 dark:bg-neutral-800" />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              <CalendarIcon className="h-4 w-4" />
              <span>Created</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {new Date(file.createdAt).toLocaleString()}
            </p>
          </div>

          <Separator className="bg-neutral-300 dark:bg-neutral-800" />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              <UserIcon className="h-4 w-4" />
              <span>{sharedByMe ? "Shared With" : isSharedFile ? "Shared By" : "Owner"}</span>
            </div>
            {sharedByMe && recipients && recipients.length > 0 ? (
              <div className="space-y-2">
                {recipients.map((recipient) => (
                  <div key={recipient.userId} className="bg-neutral-100 dark:bg-neutral-900 p-2 rounded">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {recipient.name}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {recipient.email}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                      Shared on {new Date(recipient.sharedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-lg font-medium text-neutral-900 dark:text-white">
                {ownerName || "Unknown"}
              </p>
            )}
          </div>

          {/* {file.mimeType && (
            <>
              <Separator className="bg-neutral-300 dark:bg-neutral-800" />
              <div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                  <FileIcon className="h-4 w-4" />
                  <span>Type</span>
                </div>
                <p className="text-lg font-medium text-neutral-900 dark:text-white">
                  {file.mimeType}
                </p>
              </div>
            </>
          )} */}

          <Separator className="bg-neutral-300 dark:bg-neutral-800" />

          <div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Status
            </div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Encrypted</span>
            </div>
          </div>

          {isSharedFile && (
            <>
              <Separator className="bg-neutral-300 dark:bg-neutral-800" />
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Sharing Info
                </div>
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Share2Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">Shared with you</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions - Fixed at Bottom */}
        <div className="space-y-2 pt-6 border-t border-neutral-300 dark:border-neutral-800">
          {/* Only show Share button if user is the owner */}
          {showShareButton && onShare && !isSharedFile && file.isOwner !== false && (
            <Button
              onClick={() => onShare(file)}
              className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              variant="outline"
              disabled={!file.wrappedDek}
              title={!file.wrappedDek ? "This file cannot be shared (legacy format)" : "Share this file"}
            >
              <Share2Icon className="h-4 w-4 mr-2" />
              Share File
            </Button>
          )}
          
          {/* {onPreview && (
            <Button
              onClick={() => onPreview(file)}
              className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              variant="outline"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )} */}
          
          {onDownload && (
            <Button
              onClick={() => onDownload(file)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              variant="default"
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}

          {/* Only show Delete button if user is the owner */}
          {onDelete && !isSharedFile && file.isOwner !== false && (
            <>
              <Button
                onClick={() => setIsDeleteOpen(true)}
                className="w-full"
                variant="destructive"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>

              <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm delete</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to permanently delete "{file.originalFilename}"? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                        Cancel
                      </Button>
                    </DialogClose>

                    <Button
                      variant="destructive"
                      onClick={() => {
                        try {
                          onDelete(file);
                        } finally {
                          setIsDeleteOpen(false);
                        }
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
