import { TryOnProvider } from "./provider";
import { MockTryOnProvider } from "./mock";
import { GeminiTryOnProvider } from "./gemini";

export function getTryOnProvider(): TryOnProvider {
  const providerName = process.env.TRYON_PROVIDER || "mock";

  switch (providerName) {
    case "gemini":
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not set, falling back to mock");
        return new MockTryOnProvider();
      }
      return new GeminiTryOnProvider();
    case "replicate":
      console.warn("Replicate not yet configured, falling back to mock");
      return new MockTryOnProvider();
    case "mock":
    default:
      return new MockTryOnProvider();
  }
}

export type { TryOnProvider, TryOnRequest, TryOnResponse, GarmentInput } from "./provider";
export type { Slot } from "./provider";
