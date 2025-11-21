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
  FolderIcon,
  Share2Icon,
  TrashIcon,
  DownloadIcon,
  UserIcon,
  CalendarIcon,
  InfoIcon,
  LayersIcon,
} from "lucide-react";

import type { Folder } from "@/lib/folders-api";

interface FolderSidebarProps {
  folder: Folder;
  onClose: () => void;
  onOpenFolder: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  ownerName?: string;
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
  ownerName,
  showShareButton = true,
  showDeleteButton = true,
  showDownloadButton = true,
  showOpenButton = true,
}: FolderSidebarProps) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  return (
    <aside className="w-90 flex flex-col">
      <div className="p-6 flex flex-col h-full bg-white dark:bg-purple-900/10 rounded-xl border dark:border-white/20 shadow-[0_0_28px_rgba(168,85,247,0.3)]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4 min-w-0">
            <FolderIcon className="h-8 w-8 text-purple-400" />
            <h2 className="text-lg font-semibold dark:text-white truncate">
              {folder.name}
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

        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Folder details
        </p>

        <Separator className="bg-neutral-800 mb-6" />

        {/* DETAILS AREA */}
        <div className="space-y-6 flex-1 overflow-y-auto pr-1">

          {/* FOLDER NAME */}
          <DetailBlock
            icon={<FolderIcon className="h-4 w-4 text-purple-400" />}
            label="Folder Name"
            value={folder.name}
          />

          {/* FOLDER ID */}
          <DetailBlock
            icon={<InfoIcon className="h-4 w-4 text-purple-400" />}
            label="Folder ID"
            value={folder.folderId}
          />

          {/* CREATED DATE */}
          {folder.createdAt && (
            <DetailBlock
              icon={<CalendarIcon className="h-4 w-4 text-purple-400" />}
              label="Created At"
              value={new Date(folder.createdAt).toLocaleString()}
            />
          )}

          {/* OWNER */}
          <DetailBlock
            icon={<UserIcon className="h-4 w-4 text-purple-400" />}
            label="Owner"
            value={ownerName || folder.ownerName || "Unknown"}
          />

          {/* FILE COUNT */}
          {/* {folder.fileCount !== undefined && (
            <DetailBlock
              icon={<LayersIcon className="h-4 w-4 text-purple-400" />}
              label="Items Inside"
              value={`${folder.fileCount} file(s)`}
            />
          )} */}

          <Separator className="shadow-[0_0_52px_rgba(168,85,247,0.3)]" />

          {/* STATUS */}
          <div>
            <div className="text-sm dark:text-neutral-400 font-bold mb-1 flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-purple-400" />
              Status
            </div>

            <p className="text-green-400 text-sm font-medium">
              Secure & Encrypted
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-2 pt-6 border-t border-neutral-800">
          
          {/* SHARE */}
          {showShareButton && onShare && (
            <Button
              onClick={onShare}
              variant="outline"
              className="w-full bg-neutral-900 border-neutral-700 text-white hover:bg-black/70 hover:text-white"
            >
              <Share2Icon className="h-4 w-4 mr-2" />
              Share Folder
            </Button>
          )}

          {/* DOWNLOAD */}
          {showDownloadButton && onDownload && (
            <Button
              onClick={onDownload}
              className="w-full bg-gradient-to-r from-purple-400 to-blue-300 dark:from-purple-800 dark:to-blue-900/90 hover:shadow-[0_0_10px_rgba(168,85,247,0.45)] font-bold text-black dark:text-white"
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Download Folder
            </Button>
          )}

          {/* OPEN */}
          {showOpenButton && (
            <Button
              onClick={onOpenFolder}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              <FolderIcon className="h-4 w-4 mr-2" />
              Open Folder
            </Button>
          )}

          {/* DELETE */}
          {showDeleteButton && onDelete && (
            <>
              <Button
                onClick={() => setIsDeleteOpen(true)}
                variant="destructive"
                className="w-full bg-red-500 dark:bg-red-800 hover:bg-red-900/80 text-white hover:shadow-[0_0_20px_rgba(200,0,0,0.5)]"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Folder
              </Button>

              <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="bg-white dark:bg-neutral-900 border border-neutral-700">
                  <DialogHeader>
                    <DialogTitle className="text-neutral-200">Confirm delete</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                      Delete "{folder.name}" and all files inside it? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                      <Button variant="outline" className="text-neutral-300 border-neutral-600">
                        Cancel
                      </Button>
                    </DialogClose>

                    <Button
                      variant="destructive"
                      onClick={() => {
                        onDelete();
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

/* REUSABLE DETAIL BLOCK */
function DetailBlock({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold dark:text-neutral-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-medium dark:text-white">{value}</p>
    </div>
  );
}
