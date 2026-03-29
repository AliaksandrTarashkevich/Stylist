import { GoogleGenAI } from "@google/genai";
import { nanoid } from "nanoid";
import { supabase, BUCKETS, getPublicUrl } from "@/lib/supabase";
import { TryOnProvider, TryOnRequest, TryOnResponse, GarmentInput, Slot } from "./provider";

const SLOT_DESCRIPTIONS: Record<Slot, string> = {
  top: "upper body garment",
  bottom: "lower body garment (pants/trousers/jeans/shorts/skirt)",
  shoes: "footwear",
  dress: "full body dress or jumpsuit",
  outerwear: "outer layer (coat, jacket, blazer) worn over other clothing",
};

const MAX_IMAGES_PER_GARMENT = 5;

// Build a detailed description from ALL available metadata
function describeGarment(g: GarmentInput): string {
  const parts: string[] = [];

  if (g.name) parts.push(`"${g.name}"`);
  if (g.fit) parts.push(`fit: ${g.fit}`);
  if (g.style) parts.push(`style: ${g.style}`);
  if (g.material) parts.push(`material: ${g.material}`);

  const slotDesc = SLOT_DESCRIPTIONS[g.slot] || g.slot;

  if (parts.length > 0) {
    return `${slotDesc} (${parts.join(", ")})`;
  }
  return slotDesc;
}

// Build fit instructions for the prompt
function buildFitInstructions(g: GarmentInput): string {
  const instructions: string[] = [];

  if (g.fit === "oversized" || g.fit === "relaxed") {
    instructions.push(`This garment has a ${g.fit} fit — it should appear LOOSE and ROOMY on the body, NOT fitted or tight. The fabric should drape away from the body with visible excess material.`);
  } else if (g.fit === "slim") {
    instructions.push(`This garment has a slim fit — it should follow the body's contours closely without excess fabric.`);
  } else if (g.fit === "tailored") {
    instructions.push(`This garment has a tailored fit — clean structured lines following the body shape precisely.`);
  }

  if (g.style === "wide-leg") {
    instructions.push(`The legs/cut must be WIDE — significantly wider than the leg, with lots of fabric volume below the knee.`);
  } else if (g.style === "cropped") {
    instructions.push(`This garment is CROPPED — it should end above the natural length (above ankle for pants, above waist for tops).`);
  } else if (g.style === "longline") {
    instructions.push(`This garment is LONGLINE — it extends longer than typical, past the usual hemline.`);
  } else if (g.style === "skinny" || g.style === "straight") {
    instructions.push(`The cut is ${g.style} — the silhouette should be ${g.style === "skinny" ? "very tight-fitting" : "uniform width from hip to hem"}.`);
  } else if (g.style === "tapered") {
    instructions.push(`The cut is tapered — wider at the top, narrowing toward the ankle.`);
  } else if (g.style === "A-line") {
    instructions.push(`The cut is A-line — fitted at the top and gradually widening toward the hem.`);
  } else if (g.style === "flared") {
    instructions.push(`The cut is flared — fitted through the thigh and flaring out from the knee down.`);
  }

  if (g.description) {
    instructions.push(`Product description: "${g.description}"`);
  }

  return instructions.join(" ");
}

export class GeminiTryOnProvider implements TryOnProvider {
  name = "gemini";
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.client = new GoogleGenAI({ apiKey });
  }

  private async fetchImageData(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mimeType };
  }

  async generate(request: TryOnRequest): Promise<TryOnResponse> {
    const start = Date.now();

    // Collect all image URLs: person + all garment images (primary + additional)
    const allImageUrls: string[] = [request.personImageUrl];
    const garmentImageRanges: { garment: GarmentInput; startIdx: number; endIdx: number }[] = [];

    for (const g of request.garments) {
      const startIdx = allImageUrls.length;
      allImageUrls.push(g.imageUrl);
      const additional = (g.additionalImages || []).slice(0, MAX_IMAGES_PER_GARMENT - 1);
      allImageUrls.push(...additional);
      garmentImageRanges.push({ garment: g, startIdx, endIdx: allImageUrls.length - 1 });
    }

    // Fetch all images in parallel
    const allImages = await Promise.all(allImageUrls.map((url) => this.fetchImageData(url)));

    // Build detailed garment descriptions with image references and fit instructions
    const garmentSections = garmentImageRanges.map(({ garment, startIdx, endIdx }, idx) => {
      const desc = describeGarment(garment);
      const fitInstr = buildFitInstructions(garment);
      const imageCount = endIdx - startIdx + 1;

      let imageRef: string;
      if (imageCount === 1) {
        imageRef = `Image ${startIdx + 1}`;
      } else {
        imageRef = `Images ${startIdx + 1}-${endIdx + 1} (${imageCount} photos of the same garment from different angles — study ALL of them carefully)`;
      }

      let section = `\nGARMENT ${idx + 1} — ${garment.slot.toUpperCase()}:\n${imageRef}: ${desc}`;
      if (fitInstr) {
        section += `\nFIT INSTRUCTIONS: ${fitInstr}`;
      }
      return section;
    });

    const slotNames = request.garments.map((g) => g.slot).join(", ");

    const removeOuterwearInstruction = request.removeOuterwear
      ? `\nIMPORTANT — REMOVE OUTERWEAR: The person in Image 1 may be wearing a jacket, coat, or outer layer. You MUST remove it completely before dressing them in the new garments. Show only the garments specified below — no jacket, coat, blazer, or outer layer from the original photo should remain visible.\n`
      : "";

    const prompt = `You are an expert virtual try-on system that generates photorealistic images.

IMAGE 1 is a photo of a person. The following images are clothing items to dress this person in.
${removeOuterwearInstruction}${garmentSections.join("\n")}

CRITICAL RULES:
1. Keep the person's face, body shape, pose, skin tone, and background EXACTLY the same.
2. Replace ONLY the clothing in these slots: ${slotNames}.${request.removeOuterwear ? " Remove any existing outerwear (jacket/coat/blazer) from the person FIRST." : ""}
3. MATCH THE FIT AND SILHOUETTE PRECISELY — this is the most important aspect:
   - If a garment is described as "oversized" or "wide-leg", it MUST appear loose, baggy, and roomy in the result — NOT fitted.
   - If a garment is described as "slim" or "skinny", it MUST appear tight and body-hugging.
   - Study the reference photos of each garment carefully — the way it drapes, folds, and sits on the model in those photos is EXACTLY how it should look on the target person.
4. Match the exact color, pattern, texture, and details (buttons, zippers, pockets, stitching) from the reference photos.
5. The result must look like a real photograph — natural lighting, proper shadows, realistic fabric physics. NOT a collage or photoshop overlay.
6. Where garments overlap (e.g. shirt tucked into pants), handle the layering naturally.

Generate the photorealistic try-on image now.`;

    // Build content parts: all images + prompt text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [
      ...allImages.map((img) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.buffer.toString("base64"),
        },
      })),
      { text: prompt },
    ];

    const response = await this.client.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    // Extract the generated image from response
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (!responseParts) throw new Error("No response from Gemini");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePart = responseParts.find((p: any) =>
      p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textPart = responseParts.find((p: any) => p.text);
      throw new Error(
        `Try-on failed: ${textPart?.text || "Gemini did not generate an image"}`
      );
    }

    // Upload generated image to Supabase Storage
    const mimeType = imagePart.inlineData.mimeType as string;
    const ext = mimeType === "image/png" ? ".png" : ".jpg";
    const filename = `${nanoid()}${ext}`;
    const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");

    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.results)
      .upload(filename, imageBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw new Error(`Failed to save result: ${uploadError.message}`);

    return {
      imageUrl: getPublicUrl(BUCKETS.results, filename),
      provider: this.name,
      durationMs: Date.now() - start,
    };
  }
}
