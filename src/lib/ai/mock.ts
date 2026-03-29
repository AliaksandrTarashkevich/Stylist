import { TryOnProvider, TryOnRequest, TryOnResponse } from "./provider";

/**
 * Mock provider for development/testing.
 * Returns the person image as-is (no actual try-on).
 */
export class MockTryOnProvider implements TryOnProvider {
  name = "mock";

  async generate(request: TryOnRequest): Promise<TryOnResponse> {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      imageUrl: request.personImageUrl,
      provider: this.name,
      durationMs: Date.now() - start,
    };
  }
}
