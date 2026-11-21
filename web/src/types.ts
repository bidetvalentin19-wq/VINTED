export type PhotoKind = "original" | "studio-ai" | "studio-local" | "enhanced";

export interface Photo {
  id: string;
  kind: PhotoKind;
  file: string;
  sourceId?: string;
  preset?: string;
  label?: string;
  selected: boolean;
  createdAt: string;
}

export interface ListingDetails {
  title: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  condition: string;
  colors: string[];
  materials: string[];
  price: number | null;
  priceQuick: number | null;
  priceMax: number | null;
  hashtags: string[];
  defects: string[];
  parcelSize: string;
}

export interface Listing {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready" | "published";
  photos: Photo[];
  hints: { brand?: string; size?: string; notes?: string; gender?: string };
  details: ListingDetails;
  aiNotes?: string;
}

export interface AppConfig {
  claude: boolean;
  providers: ("gemini" | "openai")[];
  presets: { id: string; label: string; description: string }[];
  backgrounds: { id: string; label: string; color: string }[];
}

export const CONDITIONS = ["Neuf avec étiquette", "Neuf sans étiquette", "Très bon état", "Bon état", "Satisfaisant"];
