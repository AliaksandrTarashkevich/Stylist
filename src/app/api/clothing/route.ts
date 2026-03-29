import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";

// GET — list all clothing items, optionally filter by slot/liked
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slot = searchParams.get("slot");
  const liked = searchParams.get("liked");

  const where: Record<string, unknown> = {};
  if (slot) where.slot = slot;
  if (liked === "true") where.liked = true;
  if (liked === "false") where.liked = false;

  const items = await prisma.clothingItem.findMany({
    where,
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

// POST — add a new clothing item
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string;
  const slot = formData.get("slot") as string;
  const sourceUrl = formData.get("sourceUrl") as string | null;
  const storeName = formData.get("storeName") as string | null;
  const price = formData.get("price") as string | null;
  const currency = formData.get("currency") as string | null;
  const fit = formData.get("fit") as string | null;
  const style = formData.get("style") as string | null;
  const material = formData.get("material") as string | null;
  const brand = formData.get("brand") as string | null;

  if (!file || !name || !slot) {
    return NextResponse.json(
      { error: "file, name, and slot are required" },
      { status: 400 }
    );
  }

  const { path: imageFile } = await saveUploadedFile(file, "clothing");

  const item = await prisma.clothingItem.create({
    data: {
      name,
      imageFile,
      slot,
      sourceUrl,
      storeName,
      price,
      currency,
      fit,
      style,
      material,
      brand,
    },
    include: { images: true },
  });

  return NextResponse.json(item);
}

// PATCH — update a clothing item (like/dislike, name, etc.)
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const item = await prisma.clothingItem.update({
    where: { id },
    data,
  });

  return NextResponse.json(item);
}

// DELETE — remove a clothing item
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.clothingItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
