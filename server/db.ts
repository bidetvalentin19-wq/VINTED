import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
export const LISTINGS_DIR = path.join(DATA_DIR, "listings");
const DB_FILE = path.join(DATA_DIR, "db.json");

export type PhotoKind = "original" | "studio-ai" | "studio-local" | "enhanced";

export interface Photo {
  id: string;
  kind: PhotoKind;
  file: string; // nom du fichier dans le dossier de l'annonce
  sourceId?: string; // photo d'origine pour les photos retouchées
  preset?: string;
  label?: string;
  selected: boolean; // incluse dans l'annonce Vinted
  createdAt: string;
}

export const CONDITIONS = [
  "Neuf avec étiquette",
  "Neuf sans étiquette",
  "Très bon état",
  "Bon état",
  "Satisfaisant",
] as const;

export interface ListingDetails {
  title: string;
  description: string;
  brand: string;
  category: string; // ex : "Femmes > Vêtements > Pulls & sweats > Pulls"
  size: string;
  condition: string;
  colors: string[];
  materials: string[];
  price: number | null;
  priceQuick: number | null;
  priceMax: number | null;
  hashtags: string[];
  defects: string[];
  parcelSize: string; // Petit / Moyen / Grand
}

export interface Listing {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready" | "published";
  photos: Photo[]; // l'ordre des photos sélectionnées = ordre sur Vinted
  hints: { brand?: string; size?: string; notes?: string; gender?: string };
  details: ListingDetails;
  aiNotes?: string;
}

interface DB {
  listings: Listing[];
}

export const emptyDetails = (): ListingDetails => ({
  title: "",
  description: "",
  brand: "",
  category: "",
  size: "",
  condition: "",
  colors: [],
  materials: [],
  price: null,
  priceQuick: null,
  priceMax: null,
  hashtags: [],
  defects: [],
  parcelSize: "",
});

function load(): DB {
  fs.mkdirSync(LISTINGS_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return { listings: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
}

let db = load();

function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const listingDir = (id: string) => path.join(LISTINGS_DIR, id);

export function listListings(): Listing[] {
  return [...db.listings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getListing(id: string): Listing | undefined {
  return db.listings.find((l) => l.id === id);
}

export function createListing(): Listing {
  const now = new Date().toISOString();
  const listing: Listing = {
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    photos: [],
    hints: {},
    details: emptyDetails(),
  };
  fs.mkdirSync(listingDir(listing.id), { recursive: true });
  db.listings.push(listing);
  save();
  return listing;
}

export function updateListing(id: string, fn: (l: Listing) => void): Listing {
  const listing = getListing(id);
  if (!listing) throw new HttpError(404, "Annonce introuvable");
  fn(listing);
  listing.updatedAt = new Date().toISOString();
  save();
  return listing;
}

export function deleteListing(id: string) {
  db.listings = db.listings.filter((l) => l.id !== id);
  fs.rmSync(listingDir(id), { recursive: true, force: true });
  save();
}

export function addPhoto(listingId: string, photo: Omit<Photo, "id" | "createdAt">): Photo {
  const full: Photo = { ...photo, id: nanoid(8), createdAt: new Date().toISOString() };
  updateListing(listingId, (l) => l.photos.push(full));
  return full;
}

export function photoPath(listingId: string, photo: Photo) {
  return path.join(listingDir(listingId), photo.file);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
