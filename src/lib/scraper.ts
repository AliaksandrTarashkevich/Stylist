import { GoogleGenAI } from "@google/genai";
import type { Slot } from "@/lib/ai/provider";

export interface ScrapedProduct {
  name: string;
  brand?: string;
  price?: string;
  currency?: string;
  material?: string;
  fit?: string;
  style?: string;
  description?: string;
  slot: Slot;
  imageUrls: string[];
}

const VALID_SLOTS: Slot[] = ["top", "bottom", "shoes", "dress", "outerwear"];

function isValidSlot(s: string): s is Slot {
  return VALID_SLOTS.includes(s as Slot);
}

function extractStoreName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace("www.", "").split(".");
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "";
  }
}

// Try to extract product data from JSON-LD structured data
function extractJsonLd(html: string): Partial<ScrapedProduct> & { imageUrls?: string[] } {
  const result: Partial<ScrapedProduct> & { imageUrls?: string[] } = {};

  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const products = Array.isArray(data) ? data : [data];

      for (const item of products) {
        if (item["@type"] !== "Product") continue;

        result.name = item.name;
        result.description = item.description;
        result.brand = item.brand?.name || item.brand;

        if (item.image) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image];
          result.imageUrls = imgs
            .map((img: string | { url: string }) =>
              typeof img === "string" ? img : img.url
            )
            .filter(Boolean);
        }

        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offer) {
          result.price = offer.price?.toString();
          result.currency = offer.priceCurrency;
        }

        if (item.material) {
          result.material = item.material;
        }

        // Try to get category for slot detection
        if (item.category) {
          result.description = `${result.description || ""} Category: ${item.category}`;
        }

        break;
      }
    } catch {
      // invalid JSON, skip
    }
  }

  return result;
}

// Always use Gemini to enrich product data — determines slot, fit, style, material, and finds all images
async function enrichWithGemini(
  html: string,
  existingData: Partial<ScrapedProduct>
): Promise<Partial<ScrapedProduct> & { imageUrls?: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const client = new GoogleGenAI({ apiKey });

  // Truncate HTML to avoid token limits
  const truncatedHtml = html.slice(0, 60000);

  const existingContext = existingData.name
    ? `\nProduct name from structured data: "${existingData.name}"\n`
    : "";

  const prompt = `Analyze this clothing product page HTML and extract ALL product information.${existingContext}

Return ONLY a valid JSON object with these fields:
{
  "name": "product name in original language",
  "brand": "brand name",
  "price": "price as string (numbers only)",
  "currency": "currency code: EUR, PLN, USD, LTL, etc.",
  "material": "material/fabric composition, e.g. '98% cotton, 2% elastane'",
  "fit": "MUST be one of: slim, regular, oversized, relaxed, tailored",
  "style": "MUST be one of: cropped, longline, A-line, straight, flared, classic, skinny, wide-leg, tapered",
  "slot": "MUST be one of: top, bottom, shoes, dress, outerwear. Determine from product type: shirts/sweaters/t-shirts/polos → top, pants/jeans/trousers/shorts/skirts/chinos → bottom, shoes/sneakers/boots/sandals → shoes, dresses/jumpsuits → dress, coats/jackets/blazers → outerwear",
  "description": "short product description (1-2 sentences)",
  "imageUrls": ["ALL product photo URLs found in the HTML - look for high-resolution product images in img tags, data attributes, srcset, JSON configs, gallery arrays. Include photos from ALL angles. Exclude icons, logos, thumbnails under 200px, UI elements. Return FULL absolute URLs."]
}

IMPORTANT:
- "slot" is CRITICAL — determine it from the product type, NOT from the name language. Pants/trousers/kelnės = bottom. Shirts/marškiniai = top. Jackets/švarkas = outerwear.
- Find ALL product images, not just the main one. Look in JavaScript variables, data-attributes, gallery configs, srcset attributes.
- Only include fields you can actually find.

HTML:
${truncatedHtml}`;

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no response");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

export async function scrapeProductUrl(url: string): Promise<ScrapedProduct> {
  // Fetch the page HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,lt;q=0.8,pl;q=0.7,ru;q=0.6",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Step 1: Extract JSON-LD (basic data — name, price, brand, maybe 1 image)
  const jsonLdData = extractJsonLd(html);

  // Step 2: ALWAYS use Gemini to enrich — it determines slot, fit, style, material, and finds ALL images
  const geminiData = await enrichWithGemini(html, jsonLdData);

  // Merge: Gemini data fills gaps, JSON-LD provides reliable name/price/brand
  // For images: combine both sources (Gemini usually finds more)
  const jsonLdImages = jsonLdData.imageUrls || [];
  const geminiImages = geminiData.imageUrls || [];

  // Deduplicate images by URL
  const allImageUrls = [...new Set([...geminiImages, ...jsonLdImages])].filter(
    (u) => u && u.startsWith("http")
  );

  // Determine slot — trust Gemini's classification
  let slot: Slot = "top";
  if (geminiData.slot && isValidSlot(geminiData.slot)) {
    slot = geminiData.slot;
  }

  const name = jsonLdData.name || geminiData.name || "Unnamed product";

  return {
    name,
    brand: jsonLdData.brand || geminiData.brand,
    price: jsonLdData.price || geminiData.price,
    currency: jsonLdData.currency || geminiData.currency,
    material: geminiData.material || jsonLdData.material,
    fit: geminiData.fit,
    style: geminiData.style,
    description: geminiData.description || jsonLdData.description,
    slot,
    imageUrls: allImageUrls,
  };
}

export function getStoreName(url: string): string {
  return extractStoreName(url);
}
