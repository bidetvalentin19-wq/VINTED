import sharp, { type Sharp, type OverlayOptions } from "sharp";

// Format final des photos : vertical 3:4, comme l'affichage des annonces Vinted.
export const OUT_W = 1200;
export const OUT_H = 1600;

export const BACKGROUNDS = {
  white: { label: "Blanc pur", stops: ["#ffffff", "#ffffff"] },
  offwhite: { label: "Blanc cassé", stops: ["#fbf9f6", "#f1ede7"] },
  pearl: { label: "Gris perle", stops: ["#f5f6f7", "#e3e6e9"] },
  beige: { label: "Beige sable", stops: ["#f6efe6", "#e8dccb"] },
  sage: { label: "Vert sauge", stops: ["#eef1ea", "#d9dfd2"] },
  blush: { label: "Rose poudré", stops: ["#fbf1ef", "#f0dcd8"] },
} as const;
export type BackgroundId = keyof typeof BACKGROUNDS;

/** Fond studio : léger dégradé radial (effet "cyclo" de studio photo). */
function backgroundSvg(id: BackgroundId): Buffer {
  const [center, edge] = BACKGROUNDS[id]?.stops ?? BACKGROUNDS.white.stops;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
    <defs><radialGradient id="g" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${center}"/><stop offset="100%" stop-color="${edge}"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
}

/**
 * Correction douce : balance des blancs "gray world" bridée (±12 % max par canal,
 * pour ne jamais changer la couleur réelle du vêtement), niveaux auto, netteté.
 */
async function colorCorrect(img: Sharp, strength = 0.5): Promise<Sharp> {
  const stats = await img.clone().stats();
  const [r, g, b] = stats.channels.slice(0, 3).map((c: { mean: number }) => c.mean);
  const avg = (r + g + b) / 3;
  const gain = (c: number) => Math.min(1.12, Math.max(0.88, 1 + (avg / Math.max(c, 1) - 1) * strength));
  return img
    .linear([gain(r), gain(g), gain(b)], [0, 0, 0])
    .normalise({ lower: 0.5, upper: 99.7 })
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 2 });
}

/**
 * Compose un packshot à partir d'un détourage PNG (fond transparent) :
 * recadrage serré, correction couleur, centrage sur fond studio, ombre portée douce.
 */
export async function composeCutout(
  cutoutPng: Buffer,
  opts: { background: BackgroundId; shadow: boolean; margin?: number },
): Promise<Buffer> {
  const trimmed = await sharp(cutoutPng).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();
  const margin = opts.margin ?? 0.08;
  const maxW = Math.round(OUT_W * (1 - margin * 2));
  const maxH = Math.round(OUT_H * (1 - margin * 2));

  // Sépare couleur et alpha pour corriger les couleurs sans abîmer la transparence.
  const resized = sharp(trimmed).resize(maxW, maxH, { fit: "inside" });
  const { data: alpha, info } = await resized.clone().extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  // Pas de balance des blancs sur un détourage : seul le vêtement reste, la corriger
  // fausserait sa couleur. On se contente d'un léger gain de netteté.
  const rgb = await resized.clone().removeAlpha().sharpen({ sigma: 0.7, m1: 0.5, m2: 2 }).raw().toBuffer();
  const garment = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toBuffer();

  const left = Math.round((OUT_W - info.width) / 2);
  const top = Math.round((OUT_H - info.height) / 2);
  const layers: OverlayOptions[] = [];

  if (opts.shadow) {
    // Ombre : silhouette noire floutée, légèrement décalée vers le bas.
    const pad = 60;
    const shadowAlpha = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#000000" })
      .blur(28)
      .linear(0.28, 0)
      .extractChannel(0)
      .raw()
      .toBuffer();
    const w = info.width + pad * 2;
    const h = info.height + pad * 2;
    const black = Buffer.alloc(w * h * 3, 0);
    const shadow = await sharp(black, { raw: { width: w, height: h, channels: 3 } })
      .joinChannel(shadowAlpha, { raw: { width: w, height: h, channels: 1 } })
      .png()
      .toBuffer();
    layers.push({ input: shadow, left: left - pad + 6, top: top - pad + 18 });
  }
  layers.push({ input: garment, left, top });

  return sharp(backgroundSvg(opts.background))
    .composite(layers)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

/** Retouche rapide sans détourage : redressement EXIF, couleurs, netteté, recadrage 3:4. */
export async function enhancePhoto(input: Buffer): Promise<Buffer> {
  const base = sharp(input).rotate();
  const corrected = await colorCorrect(base, 0.6);
  return corrected
    .resize(OUT_W, OUT_H, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

/** Normalise une image générée par l'IA au format final. */
export async function finalizeGenerated(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(OUT_W, OUT_H, { fit: "cover", position: "centre" })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}
