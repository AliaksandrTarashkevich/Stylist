"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Heart,
  HeartOff,
  ExternalLink,
  Wand2,
  Upload,
  Link,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClothingImage {
  id: string;
  imageFile: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface ClothingItem {
  id: string;
  name: string;
  imageFile: string;
  slot: string;
  sourceUrl?: string | null;
  storeName?: string | null;
  price?: string | null;
  currency?: string | null;
  liked?: boolean | null;
  fit?: string | null;
  style?: string | null;
  material?: string | null;
  brand?: string | null;
  description?: string | null;
  images: ClothingImage[];
}

const SLOT_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "shoes", label: "Shoes" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Outerwear" },
];

const FIT_OPTIONS = ["slim", "regular", "oversized", "relaxed", "tailored"];
const STYLE_OPTIONS = ["cropped", "longline", "A-line", "straight", "flared"];

export default function ClosetPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ClothingItem | null>(null);
  const [pendingImports, setPendingImports] = useState(0);

  const loadItems = useCallback(async () => {
    const url = filter ? `/api/clothing?slot=${filter}` : "/api/clothing";
    const res = await fetch(url);
    setItems(await res.json());
  }, [filter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Background import — dialog closes immediately, import runs in background
  const importInBackground = useCallback(
    (url: string) => {
      setPendingImports((n) => n + 1);
      toast.loading("Importing item...", { id: `import-${url}` });

      fetch("/api/clothing/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Import failed");
          }
          const item = await res.json();
          toast.success(`Imported: ${item.name}`, { id: `import-${url}` });
          loadItems();
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Import failed";
          toast.error(msg, { id: `import-${url}` });
        })
        .finally(() => {
          setPendingImports((n) => n - 1);
        });
    },
    [loadItems]
  );

  const toggleLike = async (e: React.MouseEvent, item: ClothingItem) => {
    e.stopPropagation();
    const newLiked = item.liked === true ? null : true;
    await fetch("/api/clothing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, liked: newLiked }),
    });
    loadItems();
  };

  const toggleDislike = async (e: React.MouseEvent, item: ClothingItem) => {
    e.stopPropagation();
    const newLiked = item.liked === false ? null : false;
    await fetch("/api/clothing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, liked: newLiked }),
    });
    loadItems();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Closet</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} items in your wardrobe
            {pendingImports > 0 && (
              <span className="ml-2 text-primary">
                · {pendingImports} importing...
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Link className="w-4 h-4 mr-2" />
            Import from URL
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Add Item Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Clothing</DialogTitle>
            </DialogHeader>
            <AddClothingFullForm
              onSuccess={() => {
                setAddOpen(false);
                loadItems();
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Import from URL Dialog */}
        <ImportFromUrlDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={(url) => {
            setImportOpen(false);
            importInBackground(url);
          }}
        />

        {/* Detail Dialog */}
        {detailItem && (
          <ItemDetailDialog
            item={detailItem}
            open={!!detailItem}
            onOpenChange={(open) => {
              if (!open) setDetailItem(null);
            }}
            onUpdate={() => {
              setDetailItem(null);
              loadItems();
            }}
            onDelete={() => {
              setDetailItem(null);
              loadItems();
            }}
          />
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={filter === null ? "default" : "secondary"}
          className="cursor-pointer"
          onClick={() => setFilter(null)}
        >
          All
        </Badge>
        {SLOT_OPTIONS.map((slot) => (
          <Badge
            key={slot.value}
            variant={filter === slot.value ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setFilter(slot.value)}
          >
            {slot.label}
          </Badge>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden group cursor-pointer"
            onClick={() => setDetailItem(item)}
          >
            <div className="relative aspect-square">
              <img
                src={item.imageFile}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => toggleLike(e, item)}
                  className={cn(
                    "p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors",
                    item.liked === true && "bg-red-500/80 hover:bg-red-500"
                  )}
                >
                  <Heart className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={(e) => toggleDislike(e, item)}
                  className={cn(
                    "p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors",
                    item.liked === false && "bg-gray-500/80"
                  )}
                >
                  <HeartOff className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <Badge className="absolute top-2 left-2" variant="secondary">
                {item.slot}
              </Badge>
            </div>
            <CardContent className="p-3 space-y-1">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <div className="flex items-center justify-between">
                {item.price && (
                  <span className="text-xs text-muted-foreground">
                    {item.currency || ""}
                    {item.price}
                  </span>
                )}
                <div className="flex gap-1">
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <a
                    href={`/?slot=${item.slot}&item=${item.id}`}
                    className="p-1 hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
              {item.storeName && (
                <span className="text-[10px] text-muted-foreground">
                  {item.storeName}
                </span>
              )}
              {/* Metadata badges */}
              <div className="flex gap-1 flex-wrap">
                {item.brand && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground font-normal"
                  >
                    {item.brand}
                  </Badge>
                )}
                {item.material && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground font-normal"
                  >
                    {item.material}
                  </Badge>
                )}
                {item.fit && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground font-normal"
                  >
                    {item.fit}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p>Your closet is empty</p>
          <p className="text-sm">Add clothing items to get started</p>
        </div>
      )}
    </div>
  );
}

/* ─── Import from URL Dialog ─── */

function ImportFromUrlDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Please enter a URL");
      return;
    }
    onImport(trimmed);
    setUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from URL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://store.com/product..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="w-full"
          >
            <Link className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Image Carousel ─── */

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
      <img
        src={images[index]}
        alt={`Image ${index + 1}`}
        className="w-full h-full object-contain"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === index ? "bg-white" : "bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Item Detail Dialog ─── */

function ItemDetailDialog({
  item,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  item: ClothingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [slot, setSlot] = useState(item.slot);
  const [fit, setFit] = useState(item.fit || "");
  const [style, setStyle] = useState(item.style || "");
  const [material, setMaterial] = useState(item.material || "");
  const [brand, setBrand] = useState(item.brand || "");
  const [price, setPrice] = useState(item.price || "");
  const [sourceUrl, setSourceUrl] = useState(item.sourceUrl || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Build carousel images: main image + images array
  const allImages: string[] = [];
  if (item.imageFile) allImages.push(item.imageFile);
  if (item.images && item.images.length > 0) {
    for (const img of item.images) {
      if (img.imageFile && img.imageFile !== item.imageFile) {
        allImages.push(img.imageFile);
      }
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/clothing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name,
          slot,
          fit: fit || null,
          style: style || null,
          material: material || null,
          brand: brand || null,
          price: price || null,
          sourceUrl: sourceUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Item updated");
      onUpdate();
    } catch {
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clothing?id=${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Item deleted");
      onDelete();
    } catch {
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Item Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image carousel */}
          <ImageCarousel images={allImages} />

          {/* Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
            />
          </div>

          {/* Slot */}
          <div className="space-y-2">
            <Label>Slot</Label>
            <div className="flex gap-2 flex-wrap">
              {SLOT_OPTIONS.map((s) => (
                <Badge
                  key={s.value}
                  variant={slot === s.value ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setSlot(s.value)}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Fit */}
          <div className="space-y-2">
            <Label>Fit</Label>
            <div className="flex gap-2 flex-wrap">
              {FIT_OPTIONS.map((f) => (
                <Badge
                  key={f}
                  variant={fit === f ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setFit(fit === f ? "" : f)}
                >
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <Label>Style</Label>
            <div className="flex gap-2 flex-wrap">
              {STYLE_OPTIONS.map((s) => (
                <Badge
                  key={s}
                  variant={style === s ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setStyle(style === s ? "" : s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          {/* Material */}
          <div className="space-y-2">
            <Label>Material</Label>
            <Input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="e.g. Cotton, Polyester..."
            />
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Nike, Zara..."
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="29.99"
            />
          </div>

          {/* Source URL */}
          <div className="space-y-2">
            <Label>Source URL</Label>
            <div className="flex gap-2">
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center"
                >
                  <Button type="button" variant="outline" size="icon">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Add Clothing Form ─── */

function AddClothingFullForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [slot, setSlot] = useState("top");
  const [sourceUrl, setSourceUrl] = useState("");
  const [price, setPrice] = useState("");
  const [fit, setFit] = useState("");
  const [style, setStyle] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Please use an image file");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!name)
      setName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (price) formData.append("price", price);
      if (fit) formData.append("fit", fit);
      if (style) formData.append("style", style);
      if (material) formData.append("material", material);
      if (brand) formData.append("brand", brand);

      const res = await fetch("/api/clothing", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to add");

      toast.success(`${name} added to closet`);
      onSuccess();
    } catch {
      toast.error("Failed to add item");
    } finally {
      setUploading(false);
    }
  };

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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
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
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
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
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="White T-shirt"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Slot</Label>
        <div className="flex gap-2 flex-wrap">
          {SLOT_OPTIONS.map((s) => (
            <Badge
              key={s.value}
              variant={slot === s.value ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setSlot(s.value)}
            >
              {s.label}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fit (optional)</Label>
        <div className="flex gap-2 flex-wrap">
          {FIT_OPTIONS.map((f) => (
            <Badge
              key={f}
              variant={fit === f ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setFit(fit === f ? "" : f)}
            >
              {f}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Style (optional)</Label>
        <div className="flex gap-2 flex-wrap">
          {STYLE_OPTIONS.map((s) => (
            <Badge
              key={s}
              variant={style === s ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setStyle(style === s ? "" : s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Material (optional)</Label>
        <Input
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="e.g. Cotton, Polyester..."
        />
      </div>
      <div className="space-y-2">
        <Label>Brand (optional)</Label>
        <Input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Nike, Zara..."
        />
      </div>
      <div className="space-y-2">
        <Label>Store URL (optional)</Label>
        <Input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label>Price (optional)</Label>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="29.99"
        />
      </div>
      <Button type="submit" className="w-full" disabled={uploading || !file}>
        {uploading ? "Adding..." : "Add to Closet"}
      </Button>
    </form>
  );
}
