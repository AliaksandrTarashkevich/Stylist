"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Zap, Heart, Wand2, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TryOnHistoryItem {
  id: string;
  resultImage: string;
  provider: string;
  durationMs: number | null;
  liked: boolean | null;
  createdAt: string;
  clothing: {
    name: string;
    imageFile: string;
    slot: string;
  };
  outfit?: {
    id: string;
    name: string | null;
    items: {
      clothing: {
        id: string;
        name: string;
        imageFile: string;
        slot: string;
      };
    }[];
  } | null;
}

type LikeFilter = "all" | "liked";

interface GroupedSection {
  key: string;
  label: string;
  outfitId: string | null;
  items: TryOnHistoryItem[];
}

export default function HistoryPage() {
  const [results, setResults] = useState<TryOnHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeFilter, setLikeFilter] = useState<LikeFilter>("all");
  const [slotFilter, setSlotFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/tryon")
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load history");
        setLoading(false);
      });
  }, []);

  const handleLike = useCallback(
    async (id: string, currentLiked: boolean | null) => {
      const nextLiked = currentLiked === true ? null : true;

      setResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, liked: nextLiked } : r))
      );

      try {
        const res = await fetch("/api/tryon", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, liked: nextLiked }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, liked: currentLiked } : r))
        );
        toast.error("Failed to update");
      }
    },
    []
  );

  const allSlots = useMemo(() => {
    const slots = new Set<string>();
    results.forEach((r) => {
      slots.add(r.clothing.slot);
      r.outfit?.items.forEach((i) => slots.add(i.clothing.slot));
    });
    return Array.from(slots).sort();
  }, [results]);

  const filtered = useMemo(() => {
    let items = results;

    if (likeFilter === "liked") {
      items = items.filter((r) => r.liked === true);
    }

    if (slotFilter) {
      items = items.filter((r) => {
        if (r.clothing.slot === slotFilter) return true;
        return r.outfit?.items.some(
          (i) => i.clothing.slot === slotFilter
        );
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((r) => {
        const outfitName = r.outfit?.name?.toLowerCase() ?? "";
        const clothingName = r.clothing.name.toLowerCase();
        return outfitName.includes(q) || clothingName.includes(q);
      });
    }

    return items;
  }, [results, likeFilter, slotFilter, searchQuery]);

  const sections = useMemo(() => {
    const outfitMap = new Map<string, TryOnHistoryItem[]>();
    const individual: TryOnHistoryItem[] = [];

    filtered.forEach((item) => {
      if (item.outfit) {
        const key = item.outfit.id;
        if (!outfitMap.has(key)) {
          outfitMap.set(key, []);
        }
        outfitMap.get(key)!.push(item);
      } else {
        individual.push(item);
      }
    });

    const groups: GroupedSection[] = [];

    outfitMap.forEach((items, outfitId) => {
      const label = items[0].outfit?.name || "Unnamed Outfit";
      groups.push({ key: outfitId, label, outfitId, items });
    });

    groups.sort((a, b) => {
      const aDate = new Date(a.items[0].createdAt).getTime();
      const bDate = new Date(b.items[0].createdAt).getTime();
      return bDate - aDate;
    });

    if (individual.length > 0) {
      groups.push({
        key: "_individual",
        label: "Individual Try-ons",
        outfitId: null,
        items: individual,
      });
    }

    return groups;
  }, [filtered]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground text-sm">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-muted-foreground">
          {results.length} try-on result{results.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={likeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setLikeFilter("all")}
          >
            All
          </Button>
          <Button
            variant={likeFilter === "liked" ? "default" : "outline"}
            size="sm"
            onClick={() => setLikeFilter("liked")}
          >
            <Heart className="w-3.5 h-3.5 mr-1 fill-current" />
            Liked
          </Button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search outfit name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {allSlots.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {allSlots.map((slot) => (
              <Badge
                key={slot}
                variant={slotFilter === slot ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() =>
                  setSlotFilter(slotFilter === slot ? null : slot)
                }
              >
                {slot}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Results grouped by outfit */}
      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{section.label}</h2>
                {section.outfitId && (
                  <Link
                    href={`/?outfit=${section.outfitId}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Open in Builder
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {section.items.map((item) => (
                  <ResultCard
                    key={item.id}
                    item={item}
                    onToggleLike={handleLike}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          {results.length === 0 ? (
            <>
              <p>No try-on results yet</p>
              <p className="text-sm">
                Go to Builder to create your first try-on
              </p>
            </>
          ) : (
            <p>No results match your filters</p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  item,
  onToggleLike,
}: {
  item: TryOnHistoryItem;
  onToggleLike: (id: string, currentLiked: boolean | null) => void;
}) {
  const outfitItems = item.outfit?.items ?? [
    { clothing: { id: item.id, ...item.clothing } },
  ];

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-[3/4]">
        <img
          src={item.resultImage}
          alt="Try-on result"
          className="w-full h-full object-cover"
        />

        <button
          onClick={() => onToggleLike(item.id, item.liked)}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm transition-colors",
            "hover:bg-black/60"
          )}
        >
          <Heart
            className={cn(
              "w-4 h-4 transition-colors",
              item.liked === true
                ? "fill-red-500 text-red-500"
                : "text-white"
            )}
          />
        </button>

        <Badge className="absolute top-2 left-2" variant="secondary">
          {item.clothing.slot}
        </Badge>
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium truncate">{item.clothing.name}</p>

        {/* Outfit clothing items as small avatars */}
        <div className="flex items-center gap-1 flex-wrap">
          {outfitItems.map((oi) => (
            <Avatar key={oi.clothing.id} className="w-6 h-6 border">
              <AvatarImage
                src={oi.clothing.imageFile}
                alt={oi.clothing.name}
                className="object-cover"
              />
              <AvatarFallback className="text-[9px]">
                {oi.clothing.slot.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.durationMs !== null ? (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {(item.durationMs / 1000).toFixed(1)}s
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600">
              <Zap className="w-3 h-3" />
              from cache
            </span>
          )}
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>

        {item.outfit && (
          <Link
            href={`/?outfit=${item.outfit.id}`}
            className="flex items-center justify-center gap-1 w-full h-7 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Wand2 className="w-3 h-3" />
            Open in Builder
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
