import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role (for Storage uploads)
export const supabase = createClient(supabaseUrl, serviceRoleKey);

// Storage bucket names
export const BUCKETS = {
  photos: "photos",
  clothing: "clothing",
  results: "results",
} as const;

// Get public URL for a file in a bucket
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
