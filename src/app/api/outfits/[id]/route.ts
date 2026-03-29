import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — single outfit with items, clothing images, and try-on results
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const outfit = await prisma.outfit.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          clothing: { include: { images: true } },
        },
      },
      tryOnResults: {
        orderBy: { createdAt: "desc" },
        include: {
          referencePhoto: true,
        },
      },
    },
  });

  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }

  return NextResponse.json(outfit);
}
