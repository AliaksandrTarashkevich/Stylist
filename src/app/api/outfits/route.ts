import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — list all outfits with items and latest try-on result
export async function GET() {
  const outfits = await prisma.outfit.findMany({
    include: {
      items: {
        include: { clothing: { include: { images: true } } },
      },
      tryOnResults: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(outfits);
}

// POST — create a new outfit
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, items } = body as {
    name?: string;
    items: { clothingId: string; slot: string }[];
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  const outfit = await prisma.outfit.create({
    data: {
      name: name || null,
      items: {
        create: items.map((item) => ({
          clothingId: item.clothingId,
          slot: item.slot,
        })),
      },
    },
    include: {
      items: { include: { clothing: true } },
    },
  });

  return NextResponse.json(outfit);
}

// PATCH — update outfit name/description/liked
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "Outfit id is required" }, { status: 400 });
  }

  const outfit = await prisma.outfit.update({
    where: { id },
    data: fields,
    include: {
      items: { include: { clothing: true } },
    },
  });

  return NextResponse.json(outfit);
}

// DELETE — remove an outfit
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Outfit id is required" }, { status: 400 });
  }

  await prisma.outfit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
