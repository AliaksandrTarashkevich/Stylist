import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateCapsuleOutfits, type CapsuleItem, type CapsuleOptions } from "@/lib/ai/capsule";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { occasion, season, count } = body as CapsuleOptions;

    const items = await prisma.clothingItem.findMany({
      select: {
        id: true,
        name: true,
        slot: true,
        color: true,
        material: true,
        fit: true,
        style: true,
        brand: true,
        description: true,
        liked: true,
        imageFile: true,
      },
    });

    if (items.length < 5) {
      return NextResponse.json(
        { error: "Add at least 5 items to your closet to generate a capsule wardrobe" },
        { status: 400 }
      );
    }

    const outfits = await generateCapsuleOutfits(
      items as CapsuleItem[],
      { occasion, season, count }
    );

    // Enrich each outfit with full item data for the frontend
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const enriched = outfits.map((outfit) => ({
      ...outfit,
      items: outfit.itemIds
        .map((id) => itemMap.get(id))
        .filter(Boolean),
    }));

    return NextResponse.json({ outfits: enriched, itemsAnalyzed: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate capsule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
