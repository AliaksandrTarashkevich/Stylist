"use client";

import { useState, useCallback } from "react";
import { Upload, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReferencePhotoUploadProps {
  photo: { id: string; path: string } | null;
  onUpload: (photo: { id: string; path: string }) => void;
}

export function ReferencePhotoUpload({ photo, onUpload }: ReferencePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image file");
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/reference", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        onUpload(data);
        toast.success("Reference photo updated");
      } catch {
        toast.error("Failed to upload photo");
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <label
        className="relative cursor-pointer group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />
        {photo ? (
          <div
            className={cn(
              "relative w-64 h-80 rounded-lg overflow-hidden border-2 transition-colors",
              dragOver
                ? "border-primary ring-2 ring-primary/30"
                : "border-border group-hover:border-primary"
            )}
          >
            <img
              src={photo.path}
              alt="Reference photo"
              className="w-full h-full object-cover"
            />
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity",
                dragOver
                  ? "bg-primary/30 opacity-100"
                  : "bg-black/40 opacity-0 group-hover:opacity-100"
              )}
            >
              <Upload className="w-8 h-8 text-white" />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "w-64 h-80 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors bg-muted/30",
              dragOver
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border group-hover:border-primary"
            )}
          >
            <User className="w-12 h-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : dragOver ? "Drop here" : "Drop photo or click"}
            </span>
            <span className="text-xs text-muted-foreground/60">Full body, front-facing</span>
          </div>
        )}
      </label>
      <span className="text-xs text-muted-foreground">Your reference photo</span>
    </div>
  );
}
