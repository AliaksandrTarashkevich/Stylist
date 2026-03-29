import { GoogleGenAI } from "@google/genai";
import type { Slot } from "./provider";

export interface CapsuleItem {
  id: string;
  name: string;
  slot: Slot;
  color: string | null;
  material: string | null;
  fit: string | null;
  style: string | null;
  brand: string | null;
  description: string | null;
  liked: boolean | null;
}

export interface CapsuleOptions {
  occasion?: "casual" | "work" | "evening" | "all";
  season?: "spring-summer" | "fall-winter" | "all";
  count?: number;
}

export interface ProposedOutfit {
  name: string;
  description: string;
  itemIds: string[];
}

const REQUIRED_SLOTS: Slot[][] = [
  ["top", "bottom", "shoes"],
  ["dress", "shoes"],
];

function buildItemCatalog(items: CapsuleItem[]): string {
  return items
    .filter((item) => item.liked !== false)
    .map((item) => {
      const parts = [
        `id="${item.id}"`,
        `slot=${item.slot}`,
        `name="${item.name}"`,
      ];
      if (item.color) parts.push(`color="${item.color}"`);
      if (item.material) parts.push(`material="${item.material}"`);
      if (item.fit) parts.push(`fit=${item.fit}`);
      if (item.style) parts.push(`style=${item.style}`);
      if (item.brand) parts.push(`brand="${item.brand}"`);
      if (item.liked === true) parts.push("liked=YES");
      if (item.description) parts.push(`desc="${item.description.slice(0, 80)}"`);
      return `ITEM[${parts.join(", ")}]`;
    })
    .join("\n");
}

function buildPrompt(catalog: string, options: CapsuleOptions): string {
  const count = options.count || 7;

  const occasionRule =
    options.occasion && options.occasion !== "all"
      ? `\n- Target occasion: ${options.occasion}. All outfits should be appropriate for ${options.occasion} settings.`
      : "";

  const seasonRule =
    options.season && options.season !== "all"
      ? `\n- Target season: ${options.season}. Prefer materials and layering suitable for ${options.season === "spring-summer" ? "warm weather (cotton, linen, light fabrics)" : "cold weather (wool, knit, layered looks)"}.`
      : "";

  return `You are an expert fashion stylist creating a capsule wardrobe from a client's closet.

CLOSET INVENTORY:
${catalog}

STYLING RULES:
- Each outfit MUST be a complete look: (top + bottom + shoes) OR (dress + shoes). Outerwear is optional on top.
- Color coordination: ensure colors complement each other. Neutrals (black, white, grey, navy, beige) pair with anything. Avoid clashing bright colors unless intentionally bold.
- Style cohesion: keep fit/style consistent within an outfit. Don't mix formal tailored items with casual streetwear unless creating an intentional contrast.
- Maximize wardrobe variety: use as many different items as possible. Each item should appear in at most 2-3 outfits.
- Prefer items marked "liked=YES" — use them more often.
- Every item ID you return MUST exist in the catalog above. Do NOT invent IDs.${occasionRule}${seasonRule}

Generate exactly ${count} outfits. Return ONLY valid JSON, no markdown fencing:
{
  "outfits": [
    {
      "name": "short descriptive outfit name (2-4 words)",
      "description": "one sentence explaining why these items work together",
      "itemIds": ["id1", "id2", "id3"]
    }
  ]
}`;
}

function validateOutfits(
  outfits: ProposedOutfit[],
  itemMap: Map<string, CapsuleItem>
): ProposedOutfit[] {
  return outfits.filter((outfit) => {
    // All IDs must exist
    const validIds = outfit.itemIds.every((id) => itemMap.has(id));
    if (!validIds) return false;

    // Must have valid slot coverage
    const slots = new Set(outfit.itemIds.map((id) => itemMap.get(id)!.slot));
    const hasValidCoverage = REQUIRED_SLOTS.some((required) =>
      required.every((slot) => slots.has(slot))
    );
    return hasValidCoverage;
  });
}

export async function generateCapsuleOutfits(
  items: CapsuleItem[],
  options: CapsuleOptions = {}
): Promise<ProposedOutfit[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const usableItems = items.filter((item) => item.liked !== false);
  if (usableItems.length < 5) {
    throw new Error("Need at least 5 non-disliked items to generate a capsule");
  }

  // Check slot coverage
  const slotCounts = new Map<Slot, number>();
  for (const item of usableItems) {
    slotCounts.set(item.slot, (slotCounts.get(item.slot) || 0) + 1);
  }

  const hasTopBottomShoes =
    slotCounts.has("top") && slotCounts.has("bottom") && slotCounts.has("shoes");
  const hasDressShoes = slotCounts.has("dress") && slotCounts.has("shoes");

  if (!hasTopBottomShoes && !hasDressShoes) {
    throw new Error(
      "Need items across compatible slots (top + bottom + shoes, or dress + shoes)"
    );
  }

  const catalog = buildItemCatalog(usableItems);
  const prompt = buildPrompt(catalog, options);

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no response");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");

  let parsed: { outfits: ProposedOutfit[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Failed to parse Gemini response as JSON");
  }

  if (!parsed.outfits || !Array.isArray(parsed.outfits)) {
    throw new Error("Invalid response structure from Gemini");
  }

  const itemMap = new Map(usableItems.map((item) => [item.id, item]));
  const validated = validateOutfits(parsed.outfits, itemMap);

  if (validated.length === 0) {
    throw new Error("AI generated no valid outfit combinations. Try again.");
  }

  return validated;
}
