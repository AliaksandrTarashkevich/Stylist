"use client";

import { useState, useEffect, useCallback } from "react";
import { Wand2, Heart, Bookmark, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReferencePhotoUpload } from "@/components/builder/ReferencePhotoUpload";
import { SlotPanel } from "@/components/builder/SlotPanel";
import { TryOnResult } from "@/components/builder/TryOnResult";
import { toast } from "sonner";

interface ReferencePhoto {
  id: string;
  path: string;
}

interface ClothingItem {
  id: string;
  name: string;
  imageFile: string;
  slot: string;
  storeName?: string | null;
  price?: string | null;
}

interface TryOnResultData {
  id: string;
  resultImage: string;
  fromCache: boolean;
  durationMs: number | null;
  outfitId?: string;
  liked?: boolean | null;
}

const SLOTS = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "shoes", label: "Shoes" },
  { key: "outerwear", label: "Outerwear" },
  { key: "dress", label: "Dress" },
] as const;

export default function BuilderPage() {
  const [referencePhoto, setReferencePhoto] = useState<ReferencePhoto | null>(null);
  const [clothingBySlot, setClothingBySlot] = useState<Record<string, ClothingItem[]>>({});
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<TryOnResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [removeOuterwear, setRemoveOuterwear] = useState(false);
  const [outfitLoaded, setOutfitLoaded] = useState(false);

  // Read outfit param from URL without useSearchParams (avoids Suspense)
  const [outfitParam, setOutfitParam] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOutfitParam(params.get("outfit"));
  }, []);

  useEffect(() => {
    fetch("/api/reference")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) setReferencePhoto(data);
      });
  }, []);

  const loadClothing = useCallback(async () => {
    const res = await fetch("/api/clothing");
    const items: ClothingItem[] = await res.json();
    const bySlot: Record<string, ClothingItem[]> = {};
    for (const item of items) {
      if (!bySlot[item.slot]) bySlot[item.slot] = [];
      bySlot[item.slot].push(item);
    }
    setClothingBySlot(bySlot);
    return items;
  }, []);

  useEffect(() => {
    loadClothing();
  }, [loadClothing]);

  // Load outfit from URL param
  useEffect(() => {
    if (!outfitParam || outfitLoaded) return;

    async function loadOutfit() {
      try {
        const res = await fetch(`/api/outfits/${outfitParam}`);
        if (!res.ok) throw new Error("Outfit not found");
        const outfit = await res.json();

        // Pre-fill selected slots
        const selections: Record<string, string | null> = {};
        for (const item of outfit.items) {
          selections[item.slot] = item.clothingId;
        }
        setSelectedBySlot(selections);

        // Show cached result if exists
        if (outfit.tryOnResults?.length > 0) {
          const latest = outfit.tryOnResults[0];
          setResult({
            id: latest.id,
            resultImage: latest.resultImage,
            fromCache: true,
            durationMs: latest.durationMs,
            outfitId: outfit.id,
            liked: latest.liked,
          });
        }

        toast.info(`Loaded outfit: ${outfit.name || "Untitled"}`);
        setOutfitLoaded(true);
      } catch {
        toast.error("Failed to load outfit");
      }
    }

    loadOutfit();
  }, [outfitParam, outfitLoaded]);

  const handleSelect = useCallback((slot: string, id: string | null) => {
    setSelectedBySlot((prev) => ({ ...prev, [slot]: id }));
  }, []);

  const handleTryOn = useCallback(async () => {
    const selectedIds = Object.values(selectedBySlot).filter((id): id is string => id != null);
    if (selectedIds.length === 0) {
      toast.error("Select a clothing item first");
      return;
    }
    if (!referencePhoto) {
      toast.error("Upload your reference photo first");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clothingIds: selectedIds, removeOuterwear }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Try-on failed");
      }
      const data = await res.json();
      setResult({
        id: data.id,
        resultImage: data.resultImage,
        fromCache: data.fromCache,
        durationMs: data.durationMs,
        outfitId: data.outfitId,
        liked: data.liked,
      });
      if (data.fromCache) {
        toast.info("Loaded from cache");
      } else {
        toast.success("Try-on complete! Outfit saved automatically.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Try-on failed");
    } finally {
      setLoading(false);
    }
  }, [selectedBySlot, referencePhoto, removeOuterwear]);

  const handleLike = useCallback(async () => {
    if (!result?.id) return;
    const newLiked = result.liked === true ? null : true;
    setResult((prev) => prev ? { ...prev, liked: newLiked } : prev);
    try {
      const res = await fetch("/api/tryon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id, liked: newLiked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setResult((prev) => prev ? { ...prev, liked: result.liked } : prev);
      toast.error("Failed to update");
    }
  }, [result]);

  const hasSelection = Object.values(selectedBySlot).some((id) => id != null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Outfit Builder</h1>
        <p className="text-sm text-muted-foreground">
          Select clothing for each slot and try it on
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-8 items-start">
        <ReferencePhotoUpload
          photo={referencePhoto}
          onUpload={setReferencePhoto}
        />

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Equipment Slots
          </h2>
          {SLOTS.map((slot) => (
            <SlotPanel
              key={slot.key}
              slot={slot.key}
              label={slot.label}
              items={clothingBySlot[slot.key] || []}
              selectedId={selectedBySlot[slot.key] || null}
              onSelect={(id) => handleSelect(slot.key, id)}
              onItemAdded={(newItemId) => {
                loadClothing();
                handleSelect(slot.key, newItemId);
              }}
            />
          ))}

          {/* Remove outerwear toggle */}
          <button
            onClick={() => setRemoveOuterwear((v) => !v)}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm transition-colors",
              removeOuterwear
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            <Shirt className="w-4 h-4" />
            Remove outerwear from photo
            {removeOuterwear && (
              <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                ON
              </Badge>
            )}
          </button>

          <Button
            onClick={handleTryOn}
            disabled={loading || !hasSelection || !referencePhoto}
            className="w-full mt-2"
            size="lg"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {loading ? "Generating..." : "Try On"}
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Result
          </h2>
          <TryOnResult
            resultImage={result?.resultImage || null}
            loading={loading}
            fromCache={result?.fromCache || false}
            durationMs={result?.durationMs || null}
          />

          {/* Like + Outfit info bar */}
          {result?.resultImage && !loading && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={cn(
                  "gap-1.5",
                  result.liked === true && "text-red-500"
                )}
              >
                <Heart className={cn("w-4 h-4", result.liked === true && "fill-current")} />
                {result.liked === true ? "Liked" : "Like"}
              </Button>
              {result.outfitId && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Bookmark className="w-3 h-3" />
                  Saved as outfit
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
