"use client";

import { useState } from "react";
import { Loader2, Sparkles, Zap, X, ZoomIn } from "lucide-react";

interface TryOnResultProps {
  resultImage: string | null;
  loading: boolean;
  fromCache: boolean;
  durationMs: number | null;
}

export function TryOnResult({ resultImage, loading, fromCache, durationMs }: TryOnResultProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (loading) {
    return (
      <div className="w-full max-w-md h-80 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 bg-muted/20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Generating try-on...</span>
      </div>
    );
  }

  if (!resultImage) {
    return (
      <div className="w-full max-w-md h-80 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 bg-muted/20">
        <Sparkles className="w-8 h-8 text-muted-foreground/40" />
        <span className="text-sm text-muted-foreground">
          Select clothing and click Try On
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div
          className="relative w-full max-w-md rounded-lg overflow-hidden border-2 border-primary/30 cursor-pointer group"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={resultImage}
            alt="Try-on result"
            className="w-full h-auto"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fromCache ? (
            <>
              <Zap className="w-3 h-3 text-yellow-500" />
              <span>From cache (instant)</span>
            </>
          ) : (
            durationMs && (
              <span>Generated in {(durationMs / 1000).toFixed(1)}s</span>
            )
          )}
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={resultImage}
            alt="Try-on result (full size)"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
