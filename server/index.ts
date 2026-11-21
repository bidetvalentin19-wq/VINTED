import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { nanoid } from "nanoid";
import {
  addPhoto,
  createListing,
  deleteListing,
  getListing,
  HttpError,
  listingDir,
  listListings,
  LISTINGS_DIR,
  photoPath,
  updateListing,
  type Listing,
  type Photo,
} from "./db.js";
import { PRESETS, buildPrompt } from "./studio/presets.js";
import { availableProviders, generateStudioImage, type Provider } from "./studio/imageGen.js";
import { BACKGROUNDS, composeCutout, enhancePhoto, finalizeGenerated, type BackgroundId } from "./studio/compose.js";
import { generateListing } from "./ai/listing.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 20 } });
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "2mb" }));

// L'extension Chrome (sur vinted.fr) lit les annonces prêtes via son service worker.
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin ?? "";
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

app.use("/files", express.static(LISTINGS_DIR, { maxAge: "1h" }));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const must = (id: string): Listing => {
  const l = getListing(id);
  if (!l) throw new HttpError(404, "Annonce introuvable");
  return l;
};
const mustPhoto = (l: Listing, pid: string): Photo => {
  const p = l.photos.find((x) => x.id === pid);
  if (!p) throw new HttpError(404, "Photo introuvable");
  return p;
};
const p = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

async function saveOriginals(listingId: string, files: Express.Multer.File[]) {
  const out: Photo[] = [];
  for (const f of files) {
    // On ré-encode en JPEG (HEIC/PNG/WebP acceptés) en conservant une bonne définition.
    const buf = await sharp(f.buffer)
      .rotate()
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer()
      .catch(() => {
        throw new HttpError(400, `Format d'image non supporté : ${f.originalname}`);
      });
    const file = `orig-${nanoid(6)}.jpg`;
    fs.writeFileSync(path.join(listingDir(listingId), file), buf);
    out.push(addPhoto(listingId, { kind: "original", file, selected: true, label: "Photo originale" }));
  }
  return out;
}

function saveDerived(listing: Listing, source: Photo, buf: Buffer, extra: Partial<Photo> & Pick<Photo, "kind">) {
  const file = `${extra.kind}-${nanoid(6)}.jpg`;
  fs.writeFileSync(path.join(listingDir(listing.id), file), buf);
  return addPhoto(listing.id, { selected: true, sourceId: source.id, file, ...extra });
}

// ---------- Configuration ----------
app.get("/api/config", (_req, res) => {
  res.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    providers: availableProviders(),
    presets: PRESETS.map(({ id, label, description }) => ({ id, label, description })),
    backgrounds: Object.entries(BACKGROUNDS).map(([id, b]) => ({ id, label: b.label, color: b.stops[1] })),
  });
});

// ---------- Annonces ----------
app.get("/api/listings", (req, res) => {
  const status = req.query.status as string | undefined;
  res.json(listListings().filter((l) => !status || l.status === status));
});

app.post(
  "/api/listings",
  upload.array("photos"),
  wrap(async (req, res) => {
    const listing = createListing();
    await saveOriginals(listing.id, (req.files as Express.Multer.File[]) ?? []);
    res.status(201).json(getListing(listing.id));
  }),
);

app.get("/api/listings/:id", (req, res) => {
  res.json(must(p(req.params.id)));
});

app.patch("/api/listings/:id", (req, res) => {
  const body = req.body ?? {};
  const listing = updateListing(p(req.params.id), (l) => {
    if (body.details) l.details = { ...l.details, ...body.details };
    if (body.hints) l.hints = { ...l.hints, ...body.hints };
    if (body.status) l.status = body.status;
    if (Array.isArray(body.photoOrder)) {
      const order: string[] = body.photoOrder;
      l.photos.sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      });
    }
    if (body.photoSelected && typeof body.photoSelected === "object") {
      for (const ph of l.photos) if (ph.id in body.photoSelected) ph.selected = Boolean(body.photoSelected[ph.id]);
    }
  });
  res.json(listing);
});

app.delete("/api/listings/:id", (req, res) => {
  deleteListing(p(req.params.id));
  res.sendStatus(204);
});

// ---------- Photos ----------
app.post(
  "/api/listings/:id/photos",
  upload.array("photos"),
  wrap(async (req, res) => {
    const l = must(p(req.params.id));
    await saveOriginals(l.id, (req.files as Express.Multer.File[]) ?? []);
    res.json(getListing(l.id));
  }),
);

app.delete("/api/listings/:id/photos/:pid", (req, res) => {
  const l = must(p(req.params.id));
  const photo = mustPhoto(l, p(req.params.pid));
  fs.rmSync(photoPath(l.id, photo), { force: true });
  res.json(updateListing(l.id, (x) => (x.photos = x.photos.filter((ph) => ph.id !== photo.id))));
});

// Studio IA : génère une photo pro à partir d'une photo source.
app.post(
  "/api/listings/:id/photos/:pid/studio",
  wrap(async (req, res) => {
    const l = must(p(req.params.id));
    const source = mustPhoto(l, p(req.params.pid));
    const { preset, extra } = req.body ?? {};
    const providers = availableProviders();
    const provider: Provider = req.body?.provider ?? providers[0];
    if (!provider || !providers.includes(provider)) {
      throw new HttpError(400, "Aucun fournisseur d'images IA configuré (GEMINI_API_KEY ou OPENAI_API_KEY dans .env)");
    }
    const prompt = buildPrompt(preset, extra, l.hints.gender);
    const generated = await generateStudioImage(provider, fs.readFileSync(photoPath(l.id, source)), prompt);
    const final = await finalizeGenerated(generated);
    const label = PRESETS.find((x) => x.id === preset)?.label ?? preset;
    const photo = saveDerived(l, source, final, { kind: "studio-ai", preset, label: `${label} (IA)` });
    res.json({ photo, listing: getListing(l.id) });
  }),
);

// Studio local (gratuit) : le navigateur détoure, le serveur compose le packshot.
app.post(
  "/api/listings/:id/photos/:pid/compose",
  upload.single("cutout"),
  wrap(async (req, res) => {
    const l = must(p(req.params.id));
    const source = mustPhoto(l, p(req.params.pid));
    if (!req.file) throw new HttpError(400, "Détourage manquant");
    const background = (req.body.background as BackgroundId) in BACKGROUNDS ? (req.body.background as BackgroundId) : "white";
    const shadow = req.body.shadow !== "false";
    const out = await composeCutout(req.file.buffer, { background, shadow });
    const photo = saveDerived(l, source, out, {
      kind: "studio-local",
      preset: `bg-${background}`,
      label: `Détouré · ${BACKGROUNDS[background].label}`,
    });
    res.json({ photo, listing: getListing(l.id) });
  }),
);

// Retouche rapide : couleurs, lumière, netteté, recadrage.
app.post(
  "/api/listings/:id/photos/:pid/enhance",
  wrap(async (req, res) => {
    const l = must(p(req.params.id));
    const source = mustPhoto(l, p(req.params.pid));
    const out = await enhancePhoto(fs.readFileSync(photoPath(l.id, source)));
    const photo = saveDerived(l, source, out, { kind: "enhanced", label: "Retouche auto" });
    res.json({ photo, listing: getListing(l.id) });
  }),
);

// ---------- Rédaction de l'annonce par Claude ----------
app.post(
  "/api/listings/:id/analyze",
  wrap(async (req, res) => {
    const l = must(p(req.params.id));
    const hints = { ...l.hints, ...(req.body?.hints ?? {}) };
    updateListing(l.id, (x) => (x.hints = hints));
    // Les originales d'abord (état réel), puis quelques rendus studio.
    const ordered = [...l.photos.filter((x) => x.kind === "original"), ...l.photos.filter((x) => x.kind !== "original")];
    const photos = ordered.slice(0, 8).map((ph) => ({
      buffer: fs.readFileSync(photoPath(l.id, ph)),
      label: ph.kind === "original" ? "photo originale du vendeur" : `rendu studio retouché : ${ph.label ?? ""}`,
    }));
    const { details, notes } = await generateListing(photos, hints);
    const listing = updateListing(l.id, (x) => {
      x.details = { ...x.details, ...details };
      x.aiNotes = notes;
    });
    res.json(listing);
  }),
);

// ---------- Export pour l'extension Vinted ----------
app.get("/api/listings/:id/export", (req, res) => {
  const l = must(p(req.params.id));
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    id: l.id,
    details: l.details,
    photos: l.photos.filter((ph) => ph.selected).map((ph) => `${base}/files/${l.id}/${ph.file}`),
  });
});

// ---------- Interface web (build de production) ----------
const webDist = path.resolve("web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api|\/files).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : String(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`\n  Vinted Studio → http://localhost:${PORT}`);
  console.log(`  Claude : ${process.env.ANTHROPIC_API_KEY ? "OK" : "clé manquante"} · Studio IA : ${availableProviders().join(", ") || "aucune clé"}\n`);
});
