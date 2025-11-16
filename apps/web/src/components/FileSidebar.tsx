import React from "react";
import { Button } from "@/components/ui/button";
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
}: FileSidebarProps) {
  if (!file) return null;

  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileIcon className="h-5 w-5 shrink-0" />
            <h2 className="text-lg font-semibold truncate">
              {file.originalFilename}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          {isSharedFile ? "Shared file details and actions" : "File details and actions"}
        </p>

        {/* Preview Placeholder */}
        <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center mb-6">
          <FileIcon className="h-16 w-16 text-neutral-400" />
        </div>

        {/* File Info - Scrollable */}
        <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <HardDriveIcon className="h-4 w-4" />
              <span>Size</span>
            </div>
            <p className="text-lg font-medium">
              {formatFileSize(file.fileSize)}
            </p>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <CalendarIcon className="h-4 w-4" />
              <span>Created</span>
            </div>
            <p className="text-lg font-medium">
              {new Date(file.createdAt).toLocaleString()}
            </p>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <UserIcon className="h-4 w-4" />
              <span>{isSharedFile ? "Shared By" : "Owner"}</span>
            </div>
            <p className="text-lg font-medium">
              {ownerName || "Unknown"}
            </p>
          </div>

          {file.mimeType && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                  <FileIcon className="h-4 w-4" />
                  <span>Type</span>
                </div>
                <p className="text-lg font-medium">
                  {file.mimeType}
                </p>
              </div>
            </>
          )}

          <Separator />

          <div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
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
              <Separator />
              <div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
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
        <div className="space-y-2 pt-6 border-t border-border">
          {showShareButton && onShare && !isSharedFile && (
            <Button
              onClick={() => onShare(file)}
              className="w-full"
              variant="outline"
              disabled={!file.wrappedDek}
              title={!file.wrappedDek ? "This file cannot be shared (legacy format)" : "Share this file"}
            >
              <Share2Icon className="h-4 w-4 mr-2" />
              Share File
            </Button>
          )}
          
          {onPreview && (
            <Button
              onClick={() => onPreview(file)}
              className="w-full"
              variant="outline"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}
          
          {onDownload && (
            <Button
              onClick={() => onDownload(file)}
              className="w-full"
              variant="default"
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}

          {onDelete && !isSharedFile && (
            <Button
              onClick={() => onDelete(file)}
              className="w-full"
              variant="destructive"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
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
