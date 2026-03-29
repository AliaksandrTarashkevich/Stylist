import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";

// GET — return the current reference photo
export async function GET() {
  const photo = await prisma.referencePhoto.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(photo);
}

// POST — upload a new reference photo (replaces previous)
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const { filename, path } = await saveUploadedFile(file, "photos");

  const photo = await prisma.referencePhoto.create({
    data: { filename, path },
  });

  return NextResponse.json(photo);
}
