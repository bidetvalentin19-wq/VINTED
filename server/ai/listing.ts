import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import { CONDITIONS, HttpError, type ListingDetails } from "../db.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const ListingSchema = z.object({
  title: z.string().describe("Titre Vinted accrocheur, max 60 caractères : type + marque + détail clé + taille"),
  description: z.string().describe("Description complète en français, aérée, avec sauts de ligne"),
  brand: z.string().describe("Marque lue sur l'étiquette/logo, ou chaîne vide si inconnue"),
  category: z.string().describe("Chemin de catégorie Vinted, ex : Femmes > Vêtements > Pulls & sweats > Pulls"),
  size: z.string().describe("Taille telle qu'affichée sur Vinted (ex : M, 38, W30 L32), vide si inconnue"),
  condition: z.enum(CONDITIONS),
  colors: z.array(z.string()).describe("1 ou 2 couleurs Vinted (Noir, Blanc, Gris, Beige, Bleu marine...)"),
  materials: z.array(z.string()).describe("Matières principales si identifiables"),
  price: z.number().describe("Prix conseillé en euros pour vendre en 1 à 2 semaines"),
  priceQuick: z.number().describe("Prix pour vendre très vite"),
  priceMax: z.number().describe("Prix haut, si l'article est recherché"),
  hashtags: z.array(z.string()).describe("5 à 8 mots-clés de recherche sans #"),
  defects: z.array(z.string()).describe("Défauts visibles sur les photos (taches, bouloches, usure...)"),
  parcelSize: z.enum(["Petit", "Moyen", "Grand"]),
  notes: z.string().describe("Conseils au vendeur : infos à vérifier, photos manquantes (étiquette, défauts...)"),
});

export type GeneratedListing = z.infer<typeof ListingSchema>;

const SYSTEM = `Tu es un vendeur Vinted expert en mode de seconde main en France.
À partir des photos d'un vêtement et des indications du vendeur, tu rédiges une annonce Vinted qui se vend vite.

Règles :
- Honnêteté absolue : ne décris que ce qui est visible ou indiqué par le vendeur. Si une info est incertaine
  (marque, taille, matière), laisse le champ vide ou signale-le dans "notes". Mentionne les défauts visibles.
- Certaines photos peuvent être des rendus studio retouchés : base l'état et les défauts sur les photos originales.
- Titre : court, mots recherchés en premier (type de vêtement, marque, coupe/détail, taille). Pas d'emojis, pas de MAJUSCULES abusives.
- Description : 1 phrase d'accroche, puis points clés (coupe, matière, détails), état précis, taille/conseil de taille,
  invitation à faire une offre ou un lot. Ton chaleureux et pro, 60 à 150 mots. Termine par les mots-clés en #hashtags.
- Prix : estime le prix de revente réaliste en seconde main sur Vinted France selon la marque, le type et l'état.
- Le vendeur a toujours raison : ses indications priment sur ton analyse des photos.`;

async function toImageBlock(buf: Buffer): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const jpeg = await sharp(buf)
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } };
}

export async function generateListing(
  photos: { buffer: Buffer; label: string }[],
  hints: { brand?: string; size?: string; notes?: string; gender?: string },
): Promise<{ details: Partial<ListingDetails>; notes: string }> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new HttpError(400, "ANTHROPIC_API_KEY manquante dans .env");
  }
  if (photos.length === 0) throw new HttpError(400, "Ajoute au moins une photo");
  const client = new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, p] of photos.slice(0, 8).entries()) {
    content.push({ type: "text", text: `Photo ${i + 1} (${p.label})` });
    content.push(await toImageBlock(p.buffer));
  }
  const hintLines = [
    hints.gender && `Rayon : ${hints.gender}`,
    hints.brand && `Marque : ${hints.brand}`,
    hints.size && `Taille : ${hints.size}`,
    hints.notes && `Notes du vendeur : ${hints.notes}`,
  ].filter(Boolean);
  content.push({
    type: "text",
    text: `Indications du vendeur :\n${hintLines.length ? hintLines.join("\n") : "(aucune)"}\n\nRédige l'annonce Vinted.`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(ListingSchema) },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "Claude a refusé de traiter ces photos. Essaie avec d'autres photos.");
    }
    const out = response.parsed_output;
    if (!out) throw new HttpError(502, "Réponse de Claude illisible, réessaie.");
    const { notes, ...details } = out;
    return { details, notes };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(401, "Clé ANTHROPIC_API_KEY invalide");
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "Limite d'API Claude atteinte, réessaie dans une minute");
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `Claude : ${err.message}`);
    throw err;
  }
}
