import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFile, UploadCategory } from "@/lib/upload";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as UploadCategory) || "clothing";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validCategories: UploadCategory[] = ["photos", "clothing", "results"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const result = await saveUploadedFile(file, category);
  return NextResponse.json(result);
}
