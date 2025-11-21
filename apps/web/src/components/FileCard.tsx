import { filesApi, type FileMetadata, type StorageUsage } from "@/lib/files-api";

import {
  File as FileIcon,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileText,
  FileCode,
} from "lucide-react";

function getFileIcon(ext?: string) {
  if (!ext) return FileIcon;

  const mapping: Record<string, any> = {
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    txt: FileText,
    jpg: FileImage,
    jpeg: FileImage,
    png: FileImage,
    gif: FileImage,
    svg: FileImage,
    mp3: FileAudio,
    wav: FileAudio,
    mp4: FileVideo,
    mov: FileVideo,
    avi: FileVideo,
    zip: FileArchive,
    rar: FileArchive,
    "7z": FileArchive,
    js: FileCode,
    ts: FileCode,
    json: FileCode,
  };

  return mapping[ext] || FileIcon;
}
import React from "react";

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${size} ${units[i]}`;
}

export function FileCard({
  file,
  onClick,
  isSelected,
}: {
  file: FileMetadata;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const ext = file.originalFilename.split(".").pop()?.toLowerCase();
  const Icon = getFileIcon(ext);

  return (
    <div
      onClick={onClick}
      className={`
        group w-full flex items-center gap-4 rounded-2xl p-4 cursor-pointer
        backdrop-blur-xl transition-all border
        bg-white/60 dark:bg-gray-900/70
        shadow-[0_2px_10px_rgba(0,0,0,0.15)]
        hover:shadow-[0_0_22px_rgba(168,85,247,0.35)]
        hover:scale-[1.01]

        ${isSelected
          ? "border-purple-500/70 ring-2 ring-purple-400"
          : "border-white/20 dark:border-white/10"}
      `}
    >
      {/* ICON */}
      <div className="flex items-center justify-center">
        <Icon className="w-10 h-10 text-purple-300 group-hover:text-purple-300 transition" />
      </div>

      {/* FILE TEXT INFO */}
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {file.originalFilename}
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {formatFileSize(file.fileSize)} • {ext?.toUpperCase() || "FILE"}
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* RIGHT-SIDE ARROW*/}
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
