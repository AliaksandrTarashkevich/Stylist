<div align="center">
  <img src="src/app/icon.svg" width="88" alt="Stylist logo" />
  <h1>Stylist</h1>
  <p><strong>An AI wardrobe that lets you try on real clothes before you buy or wear them.</strong></p>
  <p>
    <a href="https://stylist-eta.vercel.app"><strong>Live demo</strong></a>
    ·
    <a href="#how-it-works">How it works</a>
    ·
    <a href="#run-locally">Run locally</a>
  </p>
  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="Gemini" src="https://img.shields.io/badge/Gemini-Image%20Generation-8E75B2?logo=googlegemini&logoColor=white" />
    <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Storage%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white" />
  </p>
</div>

## The idea

Online clothing photos answer “how does this look on the model?” Stylist answers the more useful question: **how could these pieces look together on me?**

Upload a reference photo, build a digital closet from product links or your own images, combine garments by slot, and generate a photorealistic try-on. The same wardrobe can then be reused to create capsule outfits for an occasion or season.

## What it does

- **Multi-garment virtual try-on** — combine tops, bottoms, shoes, dresses, and outerwear in one generation.
- **Fit-aware generation** — uses garment metadata and up to five reference photos per item to preserve silhouette, material, color, and layering.
- **Import from a store URL** — extracts structured product data, then uses Gemini to classify the slot and enrich fit, style, material, and gallery images.
- **AI capsule wardrobe** — builds complete looks from owned items for casual, work, evening, or seasonal use.
- **Reusable closet** — filter, rate, edit, and organize garments instead of uploading the same item again.
- **Outfit history** — saves generated combinations, likes, source links, and generation time.
- **Generation cache** — avoids paying and waiting twice for the same person-and-outfit combination.
- **Provider abstraction** — switch between Gemini and a local mock without changing the product flow.

## How it works

```text
Product URL / image
        │
        ▼
 Closet ingestion ──► metadata + garment gallery ──► Postgres / Supabase
        │
Reference photo + selected garment slots
        │
        ▼
 Fit-aware prompt builder ──► Gemini image model ──► generated try-on
        │                                               │
        └──────────── cache key + outfit fingerprint ◄──┘
                                                        │
                                                        ▼
                                           history / likes / reuse
```

The try-on layer is intentionally isolated behind a `TryOnProvider` interface. Product code deals with a stable request and response shape; model-specific image preparation and prompting stay inside the provider.

## Product decisions

### A closet, not a one-shot generator

The product stores garments, multiple angles, fit metadata, outfits, and reactions. This makes each upload compound in value: the next outfit is faster to create and easier to compare.

### Structured constraints around generative output

An LLM can propose an outfit, but generated IDs are validated against the real closet and every result must cover a valid slot combination: `top + bottom + shoes` or `dress + shoes`. Invalid model output is rejected instead of silently leaking into the UI.

### Cost and latency are product concerns

Try-ons are keyed by the reference photo, clothing set, image count, and outerwear mode. Repeated requests load from cache while new combinations retain provider and duration metadata for later evaluation.

## Stack

| Layer | Technology |
| --- | --- |
| Product UI | Next.js 16, React 19, TypeScript, Tailwind CSS |
| AI image generation | Gemini through a provider abstraction |
| Outfit generation | Gemini with structured JSON validation |
| Data | PostgreSQL, Prisma |
| Media | Supabase Storage |
| Product import | JSON-LD, HTML parsing, Gemini enrichment |
| Deployment | Vercel |

## Run locally

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```dotenv
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
TRYON_PROVIDER=gemini
```

Create three public Supabase Storage buckets: `photos`, `clothing`, and `results`.

For UI development without image-generation spend, set:

```dotenv
TRYON_PROVIDER=mock
```

### 3. Prepare the database

```bash
npx prisma migrate deploy
```

### 4. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```text
src/
  app/                 product pages and API routes
  components/builder/  reference photo, garment slots, try-on result
  components/capsule/  capsule wardrobe flow
  lib/ai/              provider contract, Gemini try-on, capsule generation
  lib/scraper.ts       store-page ingestion and enrichment
  lib/cache.ts         generation cache keys
prisma/
  schema.prisma        closet, outfit, image, and try-on data model
```

## Current scope

Stylist is a product prototype. Virtual try-on output can still vary with pose, occlusion, source-photo quality, and model behavior. It should help someone explore and shortlist outfits, not replace sizing information or a real fitting room.

---

<div align="center">
  Built as a hands-on exploration of AI product design: model constraints, reusable user data, generation economics, and the path from a clever demo to a repeatable workflow.
</div>
