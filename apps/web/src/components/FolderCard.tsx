import React from "react";
import type { Folder } from "@/lib/folders-api";
import FolderIcon from "@/components/Folder";

export function FolderCard({
  folder,
  onClick,
  onDoubleClick,
  isSelected,
  currentUserId,
}: {
  folder: Folder;
  onClick: () => void;
  onDoubleClick: () => void;
  isSelected?: boolean;
  currentUserId: string;   // <-- NEW
}) {
  const isOwner = folder.ownerId === currentUserId;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        group relative w-full flex items-center gap-4 rounded-2xl p-4 cursor-pointer
        backdrop-blur-xl transition-all border
        bg-gray-100 dark:bg-purple-300/10
        shadow-[0_2px_7px_rgba(0,0,299,0.35)]
        hover:shadow-[0_0_22px_rgba(168,85,247,0.35)]
        hover:scale-[1.01]

        ${isSelected
          ? "border-purple-500/70 ring-2 ring-purple-400"
          : "border-white/20 dark:border-white/10"}
      `}
    >

      {/* TOP-RIGHT BADGE */}
      <div className={`absolute top-center right-12 text-white text-xs px-4 py-2 rounded-full ${isOwner ? "bg-cyan-900" : "bg-yellow-900"}`}>
        {isOwner ? "Owned": "Shared"}
      </div>

      {/* ANIMATED FOLDER ICON */}
      <div className="flex items-center justify-center">
        <FolderIcon
          color="#A855F7"
          size={0.8}
          className="transition-all"
          isOpen={isSelected}
        />
      </div>

      {/* INFO */}
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {folder.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Folder</p>
      </div>

      {/* RIGHT ARROW */}
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition">
        <svg
          className="h-4 w-4 text-purple-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
