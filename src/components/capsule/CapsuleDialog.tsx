"use client";

import { useState, useRef } from "react";
import { Loader2, Wand2, Save, X, RotateCcw, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CapsuleItemData {
  id: string;
  name: string;
  imageFile: string;
  slot: string;
  color?: string | null;
  brand?: string | null;
}

interface ProposedOutfit {
  name: string;
  description: string;
  itemIds: string[];
  items: CapsuleItemData[];
}

interface CapsuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type Phase = "configure" | "loading" | "results" | "generating";
type Occasion = "casual" | "work" | "evening" | "all";
type Season = "spring-summer" | "fall-winter" | "all";

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "casual", label: "Casual" },
  { value: "work", label: "Work" },
  { value: "evening", label: "Evening" },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "spring-summer", label: "Spring / Summer" },
  { value: "fall-winter", label: "Fall / Winter" },
];

const COUNT_OPTIONS = [5, 7, 10, 15];

export function CapsuleDialog({ open, onOpenChange, onSaved }: CapsuleDialogProps) {
  const [phase, setPhase] = useState<Phase>("configure");
  const [occasion, setOccasion] = useState<Occasion>("all");
  const [season, setSeason] = useState<Season>("all");
  const [count, setCount] = useState(7);
  const [outfits, setOutfits] = useState<ProposedOutfit[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());

  // Try-on generation state
  const [generatingIndex, setGeneratingIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<number, string>>({});
  const [generationIndices, setGenerationIndices] = useState<number[]>([]);
  const abortRef = useRef(false);

  const reset = () => {
    setPhase("configure");
    setOutfits([]);
    setDismissed(new Set());
    setSavedIndexes(new Set());
    setGeneratingIndex(0);
    setGeneratedImages({});
    setGenerationErrors({});
    setGenerationIndices([]);
    abortRef.current = false;
  };

  const handleGenerate = async () => {
    setPhase("loading");
    setDismissed(new Set());
    setSavedIndexes(new Set());

    try {
      const res = await fetch("/api/capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, season, count }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setOutfits(data.outfits);
      setPhase("results");
      toast.success(`Generated ${data.outfits.length} outfits from ${data.itemsAnalyzed} items`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate capsule");
      setPhase("configure");
    }
  };

  const handleSaveOutfit = async (outfit: ProposedOutfit, index: number): Promise<string | null> => {
    try {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: outfit.name,
          items: outfit.items.map((item) => ({
            clothingId: item.id,
            slot: item.slot,
          })),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      setSavedIndexes((prev) => new Set(prev).add(index));
      return saved.id;
    } catch {
      toast.error("Failed to save outfit");
      return null;
    }
  };

  const generateTryOns = async (indices: number[]) => {
    for (let step = 0; step < indices.length; step++) {
      if (abortRef.current) break;

      const idx = indices[step];
      setGeneratingIndex(step);

      const outfit = outfits[idx];
      const clothingIds = outfit.items.map((item) => item.id);

      try {
        const res = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clothingIds }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Generation failed");
        }

        const result = await res.json();
        if (!abortRef.current) {
          setGeneratedImages((prev) => ({ ...prev, [idx]: result.resultImage }));
        }
      } catch (err) {
        if (!abortRef.current) {
          const msg = err instanceof Error ? err.message : "Failed";
          setGenerationErrors((prev) => ({ ...prev, [idx]: msg }));
        }
      }
    }

    if (!abortRef.current) {
      setGeneratingIndex(indices.length); // signals completion
      toast.success("All try-on previews generated!");
      onSaved(); // refresh parent
    }
  };

  const handleSaveAllAndGenerate = async () => {
    setSaving(true);
    const indices: number[] = [];

    // Step 1: Save all outfits
    for (let i = 0; i < outfits.length; i++) {
      if (dismissed.has(i) || savedIndexes.has(i)) continue;
      const outfitId = await handleSaveOutfit(outfits[i], i);
      if (outfitId) {
        indices.push(i);
      }
    }

    setSaving(false);

    if (indices.length === 0) {
      toast.info("No outfits to save");
      return;
    }

    onSaved(); // refresh parent outfits list immediately

    // Step 2: Transition to generating phase
    setGenerationIndices(indices);
    setGeneratingIndex(0);
    setGeneratedImages({});
    setGenerationErrors({});
    abortRef.current = false;
    setPhase("generating");

    // Step 3: Start sequential try-on generation
    generateTryOns(indices);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let saved = 0;

    for (let i = 0; i < outfits.length; i++) {
      if (dismissed.has(i) || savedIndexes.has(i)) continue;
      await handleSaveOutfit(outfits[i], i);
      saved++;
    }

    setSaving(false);
    if (saved > 0) {
      toast.success(`Saved ${saved} outfits`);
      onSaved();
    }
  };

  const handleDismiss = (index: number) => {
    setDismissed((prev) => new Set(prev).add(index));
  };

  const activeOutfits = outfits.filter((_, i) => !dismissed.has(i));

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      abortRef.current = true;
      reset();
    }
    onOpenChange(isOpen);
  };

  const totalToGenerate = generationIndices.length;
  const completedCount = Object.keys(generatedImages).length + Object.keys(generationErrors).length;
  const allDone = completedCount >= totalToGenerate;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[85vh] overflow-y-auto",
        (phase === "results" || phase === "generating") ? "sm:max-w-4xl" : "sm:max-w-md"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            {phase === "generating"
              ? "Generating Try-On Previews"
              : phase === "results"
                ? "Capsule Wardrobe"
                : "Generate Capsule"}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Configure phase ─── */}
        {phase === "configure" && (
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Occasion</label>
              <div className="flex gap-2 flex-wrap">
                {OCCASIONS.map((o) => (
                  <Badge
                    key={o.value}
                    variant={occasion === o.value ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setOccasion(o.value)}
                  >
                    {o.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Season</label>
              <div className="flex gap-2 flex-wrap">
                {SEASONS.map((s) => (
                  <Badge
                    key={s.value}
                    variant={season === s.value ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setSeason(s.value)}
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Number of outfits</label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((c) => (
                  <Badge
                    key={c}
                    variant={count === c ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setCount(c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleGenerate}>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Capsule
            </Button>
          </div>
        )}

        {/* ─── Loading phase ─── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analyzing your wardrobe and creating outfits...
            </p>
          </div>
        )}

        {/* ─── Results phase ─── */}
        {phase === "results" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {activeOutfits.length} outfit{activeOutfits.length !== 1 ? "s" : ""} generated
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={saving || activeOutfits.every((_, i) => savedIndexes.has(i))}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Saving..." : "Save Only"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAllAndGenerate}
                  disabled={saving || activeOutfits.every((_, i) => savedIndexes.has(i))}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Saving..." : "Save & Try On"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outfits.map((outfit, index) => {
                if (dismissed.has(index)) return null;
                const isSaved = savedIndexes.has(index);

                return (
                  <Card
                    key={index}
                    className={cn(
                      "relative transition-opacity",
                      isSaved && "opacity-60"
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{outfit.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {outfit.description}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {isSaved ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Check className="w-3 h-3" />
                              Saved
                            </Badge>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSaveOutfit(outfit, index)}
                              >
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => handleDismiss(index)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {outfit.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1"
                          >
                            <img
                              src={item.imageFile}
                              alt={item.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate max-w-[100px]">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {item.slot}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Generating try-on phase ─── */}
        {phase === "generating" && (
          <div className="space-y-4">
            {/* Progress header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {allDone
                    ? `Done! ${Object.keys(generatedImages).length} preview${Object.keys(generatedImages).length !== 1 ? "s" : ""} generated.`
                    : `Generating preview ${Math.min(generatingIndex + 1, totalToGenerate)} of ${totalToGenerate}...`}
                </span>
                {allDone && (
                  <Button size="sm" onClick={() => handleClose(false)}>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Done
                  </Button>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${totalToGenerate > 0 ? (completedCount / totalToGenerate) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Outfit cards with streaming images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {generationIndices.map((outfitIndex, step) => {
                const outfit = outfits[outfitIndex];
                const generatedImage = generatedImages[outfitIndex];
                const error = generationErrors[outfitIndex];
                const isCurrentlyGenerating = !allDone && generatingIndex === step && !generatedImage && !error;
                const isWaiting = !allDone && generatingIndex < step && !generatedImage && !error;

                return (
                  <Card key={outfitIndex} className="overflow-hidden">
                    <CardContent className="p-3 space-y-2">
                      {/* Try-on result area */}
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {generatedImage ? (
                          <img
                            src={generatedImage}
                            alt={outfit.name}
                            className="w-full h-full object-cover"
                          />
                        ) : error ? (
                          <div className="text-center p-4">
                            <p className="text-sm text-destructive">{error}</p>
                          </div>
                        ) : isCurrentlyGenerating ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground">Generating...</p>
                          </div>
                        ) : isWaiting ? (
                          <div className="flex flex-col items-center gap-2">
                            <Sparkles className="w-5 h-5 text-muted-foreground/50" />
                            <p className="text-xs text-muted-foreground">Waiting...</p>
                          </div>
                        ) : null}
                      </div>

                      {/* Outfit info */}
                      <p className="text-sm font-medium truncate">{outfit.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {outfit.description}
                      </p>

                      {/* Item thumbnails row */}
                      <div className="flex gap-1.5 overflow-x-auto">
                        {outfit.items.map((item) => (
                          <img
                            key={item.id}
                            src={item.imageFile}
                            alt={item.name}
                            className="w-7 h-7 rounded object-cover shrink-0"
                            title={`${item.name} (${item.slot})`}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
