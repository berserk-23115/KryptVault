import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { FolderOpen, Download, Share2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import type { Folder } from "@/lib/folders-api";

interface FolderSidebarProps {
  folder: Folder;
  onClose: () => void;
  onOpenFolder: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  showShareButton?: boolean;
  showDeleteButton?: boolean;
  showDownloadButton?: boolean;
  showOpenButton?: boolean;
}

export function FolderSidebar({
  folder,
  onClose,
  onOpenFolder,
  onDelete,
  onShare,
  onDownload,
  showShareButton = true,
  showDeleteButton = true,
  showDownloadButton = true,
  showOpenButton = true,
}: FolderSidebarProps) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const handleDownloadFolder = async () => {
    if (onDownload) {
      onDownload();
    } else {
      toast.info("Downloading folder...", {
        description: "This feature will download all files in the folder.",
      });
      // TODO: Implement folder download functionality
    }
  };

  return (
    <aside className="w-96 border-l border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col overflow-y-auto">
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderOpen className="h-5 w-5 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
              {folder.name}
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
          Folder details and options
        </p>

        {/* Folder Icon Preview */}
        <div className="aspect-video bg-linear-to-br from-purple-200 to-purple-400 dark:from-purple-600 dark:to-purple-800 rounded-lg flex items-center justify-center mb-6">
          <FolderOpen className="h-16 w-16 text-purple-800 dark:text-white" />
        </div>

        {/* Folder Info - Scrollable */}
        <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              <FolderOpen className="h-4 w-4" />
              <span>Folder Name</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {folder.name}
            </p>
          </div>

          <Separator className="bg-neutral-300 dark:bg-neutral-800" />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              <User className="h-4 w-4" />
              <span>Owner</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {folder.ownerName}
            </p>
          </div>
        </div>

        {/* Actions - Fixed at Bottom */}
        <div className="space-y-2 pt-6 border-t border-neutral-300 dark:border-neutral-800">
          {showShareButton && onShare && (
            <Button
              onClick={onShare}
              className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              variant="outline"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Folder
            </Button>
          )}
          
          {showDownloadButton && (
            <Button
              onClick={handleDownloadFolder}
              className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Folder
            </Button>
          )}
          
          {showOpenButton && (
            <Button
              onClick={onOpenFolder}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              variant="default"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Open Folder
            </Button>
          )}

          {showDeleteButton && onDelete && (
            <>
              <Button
                onClick={() => setIsDeleteOpen(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Folder
              </Button>

              <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800">
                  <DialogHeader>
                    <DialogTitle className="text-neutral-900 dark:text-white">Confirm delete</DialogTitle>
                    <DialogDescription className="text-neutral-600 dark:text-neutral-400">
                      Are you sure you want to permanently delete "{folder.name}" and all files inside it? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700">
                        Cancel
                      </Button>
                    </DialogClose>

                    <Button
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        try {
                          onDelete();
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
