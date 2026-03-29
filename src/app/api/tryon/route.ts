import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTryOnProvider } from "@/lib/ai";
import { generateCacheKey } from "@/lib/cache";
import type { Slot } from "@/lib/ai";
import crypto from "crypto";

function generateFingerprint(clothingIds: string[]): string {
  const sorted = [...clothingIds].sort().join(",");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const clothingIds: string[] = body.clothingIds || (body.clothingId ? [body.clothingId] : []);
  const removeOuterwear: boolean = body.removeOuterwear || false;

  if (clothingIds.length === 0) {
    return NextResponse.json({ error: "At least one clothing item is required" }, { status: 400 });
  }

  // Get reference photo
  const referencePhoto = await prisma.referencePhoto.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!referencePhoto) {
    return NextResponse.json(
      { error: "No reference photo set. Please upload your photo first." },
      { status: 400 }
    );
  }

  // Get all clothing items with their additional images
  const clothingItems = await prisma.clothingItem.findMany({
    where: { id: { in: clothingIds } },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (clothingItems.length === 0) {
    return NextResponse.json({ error: "Clothing items not found" }, { status: 404 });
  }

  // Check cache (include image count + removeOuterwear flag so variants produce different results)
  const imageCountSuffix = clothingItems.map((c) => c.images.length).join(",") + (removeOuterwear ? ":nocoat" : "");
  const cacheKey = generateCacheKey(
    referencePhoto.id,
    clothingItems.map((c) => c.id),
    imageCountSuffix
  );
  const cached = await prisma.tryOnResult.findUnique({ where: { cacheKey } });

  // Find or create outfit
  const fingerprint = generateFingerprint(clothingItems.map((c) => c.id));
  let outfit = await prisma.outfit.findUnique({ where: { fingerprint } });

  if (!outfit) {
    const autoName = clothingItems.map((c) => c.name).join(" + ");
    outfit = await prisma.outfit.create({
      data: {
        name: autoName.length > 100 ? autoName.slice(0, 97) + "..." : autoName,
        fingerprint,
        items: {
          create: clothingItems.map((c) => ({
            clothingId: c.id,
            slot: c.slot,
          })),
        },
      },
    });
  }

  if (cached) {
    // Link cached result to outfit if not already linked
    if (!cached.outfitId) {
      await prisma.tryOnResult.update({
        where: { id: cached.id },
        data: { outfitId: outfit.id },
      });
    }

    return NextResponse.json({
      ...cached,
      outfitId: outfit.id,
      fromCache: true,
    });
  }

  // Generate try-on via AI with all images and metadata
  try {
    const provider = getTryOnProvider();
    const result = await provider.generate({
      personImageUrl: referencePhoto.path,
      removeOuterwear,
      garments: clothingItems.map((c) => ({
        imageUrl: c.imageFile,
        additionalImages: c.images
          .filter((img) => !img.isPrimary)
          .slice(0, 4) // max 4 additional
          .map((img) => img.imageFile),
        slot: c.slot as Slot,
        name: c.name ?? undefined,
        fit: c.fit ?? undefined,
        style: c.style ?? undefined,
        material: c.material ?? undefined,
        description: c.description ?? undefined,
      })),
    });

    // Save result linked to outfit
    const tryOnResult = await prisma.tryOnResult.create({
      data: {
        resultImage: result.imageUrl,
        cacheKey,
        referenceId: referencePhoto.id,
        clothingId: clothingItems[0].id,
        outfitId: outfit.id,
        provider: result.provider,
        durationMs: result.durationMs,
      },
    });

    // Update outfit cover image
    await prisma.outfit.update({
      where: { id: outfit.id },
      data: { coverImage: result.imageUrl },
    });

    return NextResponse.json({
      ...tryOnResult,
      outfitId: outfit.id,
      fromCache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[tryon] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — list try-on history with outfit info
export async function GET() {
  const results = await prisma.tryOnResult.findMany({
    include: {
      clothing: true,
      referencePhoto: true,
      outfit: {
        include: {
          items: { include: { clothing: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(results);
}

// PATCH — update liked status on a try-on result
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, liked } = body;

  if (!id) {
    return NextResponse.json({ error: "Result id is required" }, { status: 400 });
  }

  const result = await prisma.tryOnResult.update({
    where: { id },
    data: { liked },
  });

  return NextResponse.json(result);
}
