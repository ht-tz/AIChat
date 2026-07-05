"use client";

import { X, FileText, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/types";

interface FileAttachmentCardProps {
  attachment: Attachment;
  onRemove?: () => void;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentCard({ attachment, onRemove, compact }: FileAttachmentCardProps) {
  const isImage = attachment.type === "image";

  if (isImage) {
    return (
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border border-cyber-border bg-cyber-surface/40",
          compact ? "size-20" : "size-24",
        )}
      >
        <Image
          src={attachment.url}
          alt={attachment.name}
          fill
          unoptimized
          className="object-cover"
          sizes={compact ? "80px" : "96px"}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-cyber-bg/80 text-cyber-muted opacity-0 transition-opacity hover:bg-cyber-danger hover:text-white group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border border-cyber-border bg-cyber-surface/40 p-2",
        compact ? "max-w-[180px]" : "max-w-[220px]",
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-cyber-cyan/10 text-cyber-cyan">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-cyber-text">{attachment.name}</p>
        {attachment.size && (
          <p className="text-[10px] text-cyber-muted">{formatFileSize(attachment.size)}</p>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-cyber-muted opacity-0 transition-opacity hover:bg-cyber-danger/20 hover:text-cyber-danger group-hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
