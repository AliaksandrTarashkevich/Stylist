"use client";

import { useState } from "react";
import { Loader2, Wand2, Save, X, RotateCcw, Check } from "lucide-react";
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
  const [phase, setPhase] = useState<"configure" | "loading" | "results">("configure");
  const [occasion, setOccasion] = useState<Occasion>("all");
  const [season, setSeason] = useState<Season>("all");
  const [count, setCount] = useState(7);
  const [outfits, setOutfits] = useState<ProposedOutfit[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());

  const reset = () => {
    setPhase("configure");
    setOutfits([]);
    setDismissed(new Set());
    setSavedIndexes(new Set());
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

  const handleSaveOutfit = async (outfit: ProposedOutfit, index: number) => {
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
      setSavedIndexes((prev) => new Set(prev).add(index));
      toast.success(`Saved: ${outfit.name}`);
    } catch {
      toast.error("Failed to save outfit");
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const toSave = outfits.filter((_, i) => !dismissed.has(i) && !savedIndexes.has(i));
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
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[85vh] overflow-y-auto",
        phase === "results" ? "sm:max-w-4xl" : "sm:max-w-md"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            {phase === "results" ? "Capsule Wardrobe" : "Generate Capsule"}
          </DialogTitle>
        </DialogHeader>

        {phase === "configure" && (
          <div className="space-y-5 pt-2">
            {/* Occasion */}
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

            {/* Season */}
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

            {/* Count */}
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

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analyzing your wardrobe and creating outfits...
            </p>
          </div>
        )}

        {phase === "results" && (
          <div className="space-y-4">
            {/* Actions bar */}
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
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={saving || activeOutfits.every((_, i) => savedIndexes.has(i))}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Saving..." : "Save All"}
                </Button>
              </div>
            </div>

            {/* Outfit grid */}
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
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {outfit.name}
                          </p>
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

                      {/* Item thumbnails */}
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
      </DialogContent>
    </Dialog>
  );
}
