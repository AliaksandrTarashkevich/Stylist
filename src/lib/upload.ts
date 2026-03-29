import { nanoid } from "nanoid";
import { supabase, BUCKETS, getPublicUrl } from "./supabase";

export type UploadCategory = "photos" | "clothing" | "results";

export async function saveUploadedFile(
  file: File,
  category: UploadCategory
): Promise<{ filename: string; path: string }> {
  const ext = file.name.split(".").pop() || "png";
  const filename = `${nanoid()}.${ext}`;
  const bucket = BUCKETS[category];

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const publicUrl = getPublicUrl(bucket, filename);
  return { filename, path: publicUrl };
}

export async function saveImageFromUrl(
  imageUrl: string,
  category: UploadCategory
): Promise<{ filename: string; path: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("webp")) ext = "webp";

  const filename = `${nanoid()}.${ext}`;
  const bucket = BUCKETS[category];

  const buffer = Buffer.from(await response.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: contentType || "image/png",
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const publicUrl = getPublicUrl(bucket, filename);
  return { filename, path: publicUrl };
}

// Helper: get a file from Storage as a buffer (for sending to AI)
export async function getFileBuffer(
  category: UploadCategory,
  filename: string
): Promise<Buffer> {
  const bucket = BUCKETS[category];
  const { data, error } = await supabase.storage.from(bucket).download(filename);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}
