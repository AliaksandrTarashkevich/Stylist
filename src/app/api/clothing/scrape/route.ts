import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeProductUrl, getStoreName } from "@/lib/scraper";
import { saveImageFromUrl } from "@/lib/upload";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Scrape the product page
    const product = await scrapeProductUrl(url);

    if (product.imageUrls.length === 0) {
      return NextResponse.json(
        { error: "No product images found on this page" },
        { status: 400 }
      );
    }

    // Download all images to Supabase Storage in parallel
    const imageResults = await Promise.allSettled(
      product.imageUrls.map((imgUrl) => saveImageFromUrl(imgUrl, "clothing"))
    );

    const savedImages = imageResults
      .filter((r): r is PromiseFulfilledResult<{ filename: string; path: string }> =>
        r.status === "fulfilled"
      )
      .map((r) => r.value);

    if (savedImages.length === 0) {
      return NextResponse.json(
        { error: "Failed to download any product images" },
        { status: 500 }
      );
    }

    // Create ClothingItem with first image as primary
    const primaryImage = savedImages[0];
    const storeName = getStoreName(url);

    const clothingItem = await prisma.clothingItem.create({
      data: {
        name: product.name,
        imageFile: primaryImage.path,
        slot: product.slot,
        sourceUrl: url,
        storeName,
        price: product.price,
        currency: product.currency,
        brand: product.brand,
        material: product.material,
        fit: product.fit,
        style: product.style,
        description: product.description,
        // Create ClothingImage records for ALL images
        images: {
          create: savedImages.map((img, index) => ({
            imageFile: img.path,
            isPrimary: index === 0,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json(clothingItem);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    console.error("[scrape] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
