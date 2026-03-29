"use client";

import { useState, useCallback } from "react";
import { Plus, Check, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClothingItem {
  id: string;
  name: string;
  imageFile: string;
  slot: string;
  storeName?: string | null;
  price?: string | null;
}

interface SlotPanelProps {
  slot: string;
  label: string;
  items: ClothingItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onItemAdded: (newItemId: string) => void;
}

const SLOT_LABELS: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  dress: "Dress",
  outerwear: "Outerwear",
};

export function SlotPanel({ slot, label, items, selectedId, onSelect, onItemAdded }: SlotPanelProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {label || SLOT_LABELS[slot] || slot}
        </Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3" />
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {label}</DialogTitle>
            </DialogHeader>
            <AddClothingForm
              slot={slot}
              onSuccess={(newItemId) => {
                setAddOpen(false);
                onItemAdded(newItemId);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {items.length === 0 ? (
            <div className="w-20 h-20 rounded border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground text-center px-1">No items</span>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(selectedId === item.id ? null : item.id)}
                className={cn(
                  "relative w-20 h-20 rounded border-2 overflow-hidden flex-shrink-0 transition-all",
                  selectedId === item.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                )}
              >
                <img
                  src={item.imageFile}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                {selectedId === item.id && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AddClothingForm({ slot, onSuccess }: { slot: string; onSuccess: (newItemId: string) => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Please use an image file");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
  }, [name]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file || !name) {
        toast.error("Name and image are required");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("slot", slot);
        if (sourceUrl) formData.append("sourceUrl", sourceUrl);

        const res = await fetch("/api/clothing", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Failed to add clothing");

        const newItem = await res.json();
        toast.success(`${name} added`);
        onSuccess(newItem.id);
      } catch {
        toast.error("Failed to add clothing");
      } finally {
        setUploading(false);
      }
    },
    [file, name, slot, sourceUrl, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
          dragOver
            ? "border-primary bg-primary/10"
            : preview
              ? "border-border"
              : "border-border hover:border-primary/50"
        )}
      >
        <label className="cursor-pointer block">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
          {preview ? (
            <div className="relative aspect-square max-h-48 mx-auto">
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {dragOver ? "Drop image here" : "Drop image or click to browse"}
              </span>
            </div>
          )}
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Black T-shirt"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">Store URL (optional)</Label>
        <Input
          id="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://www2.hm.com/..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={uploading || !file}>
        {uploading ? "Adding..." : "Add to closet"}
      </Button>
    </form>
  );
}
