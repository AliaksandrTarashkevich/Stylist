"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart,
  Trash2,
  ExternalLink,
  Scale,
  Check,
  Pencil,
  Loader2,
  Wand2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CapsuleDialog } from "@/components/capsule/CapsuleDialog";

interface OutfitClothing {
  id: string;
  name: string;
  imageFile: string;
  slot: string;
}

interface OutfitItem {
  id: string;
  clothingId: string;
  slot: string;
  clothing: OutfitClothing;
}

interface TryOnResultItem {
  id: string;
  resultImage: string;
  durationMs: number | null;
  createdAt: string;
}

interface Outfit {
  id: string;
  name: string | null;
  description: string | null;
  coverImage: string | null;
  liked: boolean | null;
  createdAt: string;
  updatedAt: string;
  items: OutfitItem[];
  tryOnResults: TryOnResultItem[];
}

function getOutfitImage(outfit: Outfit): string | null {
  if (outfit.coverImage) return outfit.coverImage;
  if (outfit.tryOnResults.length > 0) return outfit.tryOnResults[0].resultImage;
  return null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [capsuleOpen, setCapsuleOpen] = useState(false);

  const loadOutfits = useCallback(async () => {
    try {
      const res = await fetch("/api/outfits");
      if (!res.ok) throw new Error("Failed to load outfits");
      setOutfits(await res.json());
    } catch {
      toast.error("Failed to load outfits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutfits();
  }, [loadOutfits]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleLike = async (outfit: Outfit, value: boolean) => {
    const newLiked = outfit.liked === value ? null : value;
    try {
      await fetch("/api/outfits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: outfit.id, liked: newLiked }),
      });
      loadOutfits();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/outfits?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Outfit deleted");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadOutfits();
    } catch {
      toast.error("Failed to delete outfit");
    }
  };

  const startEditing = (outfit: Outfit) => {
    setEditingId(outfit.id);
    setEditValue(outfit.name || "");
  };

  const saveEdit = async (id: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;

    try {
      await fetch("/api/outfits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });
      loadOutfits();
    } catch {
      toast.error("Failed to rename outfit");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        toast.error("Select up to 4 outfits to compare");
      }
      return next;
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelected(new Set());
  };

  const selectedOutfits = outfits.filter((o) => selected.has(o.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Outfits</h1>
          <p className="text-sm text-muted-foreground">
            {outfits.length} saved combination{outfits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {compareMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exitCompareMode}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selected.size < 2}
                onClick={() => setCompareOpen(true)}
              >
                <Scale className="w-4 h-4 mr-2" />
                Compare ({selected.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setCapsuleOpen(true)}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Capsule
              </Button>
              {outfits.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompareMode(true)}
                >
                  <Scale className="w-4 h-4 mr-2" />
                  Compare
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      {outfits.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No outfits yet</p>
          <p className="text-sm">
            Save combinations from the{" "}
            <a href="/" className="underline hover:text-foreground">
              Builder
            </a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {outfits.map((outfit) => {
            const image = getOutfitImage(outfit);
            const isSelected = selected.has(outfit.id);

            return (
              <Card
                key={outfit.id}
                className={cn(
                  "overflow-hidden group relative transition-all",
                  compareMode && "cursor-pointer",
                  isSelected && "ring-2 ring-primary"
                )}
                onClick={compareMode ? () => toggleSelect(outfit.id) : undefined}
              >
                {/* Compare checkbox overlay */}
                {compareMode && (
                  <div
                    className={cn(
                      "absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-primary border-primary"
                        : "bg-black/40 border-white/70"
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    )}
                  </div>
                )}

                {/* Cover image */}
                <div className="relative" style={{ aspectRatio: "3/4" }}>
                  {image ? (
                    <img
                      src={image}
                      alt={outfit.name || "Outfit"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        No image
                      </span>
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  {!compareMode && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(outfit, true);
                        }}
                        className={cn(
                          "p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors",
                          outfit.liked === true &&
                            "bg-red-500/80 hover:bg-red-500"
                        )}
                      >
                        <Heart
                          className={cn(
                            "w-3.5 h-3.5 text-white",
                            outfit.liked === true && "fill-white"
                          )}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(outfit, false);
                        }}
                        className={cn(
                          "p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors",
                          outfit.liked === false && "bg-gray-500/80"
                        )}
                      >
                        <Heart className="w-3.5 h-3.5 text-white/50" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(outfit.id);
                        }}
                        className="p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card content */}
                <CardContent className="p-3 space-y-2">
                  {/* Name (editable) */}
                  <div className="flex items-center gap-1 min-h-[1.5rem]">
                    {editingId === outfit.id ? (
                      <Input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(outfit.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(outfit.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-6 text-sm px-1 py-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="flex items-center gap-1 group/name text-left min-w-0"
                        onClick={(e) => {
                          if (compareMode) return;
                          e.stopPropagation();
                          startEditing(outfit);
                        }}
                      >
                        <span className="text-sm font-medium truncate">
                          {outfit.name || "Untitled outfit"}
                        </span>
                        {!compareMode && (
                          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 shrink-0" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Date + link */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(outfit.createdAt)}
                    </span>
                    {!compareMode && (
                      <a
                        href={`/?outfit=${outfit.id}`}
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Builder
                      </a>
                    )}
                  </div>

                  {/* Clothing item thumbnails */}
                  {outfit.items.length > 0 && (
                    <div className="flex gap-1.5 pt-1">
                      {outfit.items.map((item) => (
                        <div
                          key={item.id}
                          className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-border shrink-0"
                          title={`${item.clothing.name} (${item.slot})`}
                        >
                          <img
                            src={item.clothing.imageFile}
                            alt={item.clothing.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Liked badge */}
                  {outfit.liked === true && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Heart className="w-2.5 h-2.5 mr-1 fill-current text-red-500" />
                      Liked
                    </Badge>
                  )}
                  {outfit.liked === false && (
                    <Badge variant="secondary" className="text-[10px]">
                      Disliked
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Outfits</DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "grid gap-4",
              selectedOutfits.length === 2 && "grid-cols-2",
              selectedOutfits.length === 3 && "grid-cols-3",
              selectedOutfits.length >= 4 && "grid-cols-2 sm:grid-cols-4"
            )}
          >
            {selectedOutfits.map((outfit) => {
              const image = getOutfitImage(outfit);
              return (
                <div key={outfit.id} className="space-y-3">
                  {/* Try-on result image */}
                  <div
                    className="rounded-lg overflow-hidden bg-muted"
                    style={{ aspectRatio: "3/4" }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={outfit.name || "Outfit"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Outfit name */}
                  <p className="text-sm font-medium text-center truncate">
                    {outfit.name || "Untitled outfit"}
                  </p>

                  {/* Clothing items list */}
                  <div className="space-y-1.5">
                    {outfit.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                          <img
                            src={item.clothing.imageFile}
                            alt={item.clothing.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="truncate block">
                            {item.clothing.name}
                          </span>
                          <span className="text-muted-foreground">
                            {item.slot}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Liked status */}
                  {outfit.liked === true && (
                    <div className="flex justify-center">
                      <Badge variant="secondary" className="text-[10px]">
                        <Heart className="w-2.5 h-2.5 mr-1 fill-current text-red-500" />
                        Liked
                      </Badge>
                    </div>
                  )}
                  {outfit.liked === false && (
                    <div className="flex justify-center">
                      <Badge variant="secondary" className="text-[10px]">
                        Disliked
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <CapsuleDialog
        open={capsuleOpen}
        onOpenChange={setCapsuleOpen}
        onSaved={loadOutfits}
      />
    </div>
  );
}
