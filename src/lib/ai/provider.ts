export type Slot = "top" | "bottom" | "shoes" | "dress" | "outerwear";

export interface GarmentInput {
  imageUrl: string;
  additionalImages?: string[]; // up to 4 extra photos for better fit/cut understanding
  slot: Slot;
  name?: string;
  fit?: string;
  style?: string;
  material?: string;
  description?: string;
}

export interface TryOnRequest {
  personImageUrl: string;
  garments: GarmentInput[];
  removeOuterwear?: boolean; // strip jacket/coat from reference photo before try-on
}

export interface TryOnResponse {
  imageUrl: string; // URL to the generated image
  provider: string;
  durationMs: number;
}

export interface TryOnProvider {
  name: string;
  generate(request: TryOnRequest): Promise<TryOnResponse>;
}
