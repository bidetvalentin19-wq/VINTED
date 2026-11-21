import sharp from "sharp";
import { HttpError } from "../db.js";

export type Provider = "gemini" | "openai";

export function availableProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

/** Prépare la photo source : orientation EXIF corrigée, taille raisonnable. */
async function prepareInput(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function generateStudioImage(
  provider: Provider,
  input: Buffer,
  prompt: string,
): Promise<Buffer> {
  const source = await prepareInput(input);
  const raw = provider === "gemini" ? await withGemini(source, prompt) : await withOpenAI(source, prompt);
  return raw;
}

async function withGemini(image: Buffer, prompt: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(400, "GEMINI_API_KEY manquante dans .env");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }),
    },
  );
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, `Gemini : ${json?.error?.message ?? res.statusText}`);
  }
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!img) {
    const reason = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? "aucune image";
    throw new HttpError(502, `Gemini n'a pas renvoyé d'image (${reason}). Réessaie ou change de préréglage.`);
  }
  return Buffer.from((img.inlineData ?? img.inline_data).data, "base64");
}

async function withOpenAI(image: Buffer, prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(400, "OPENAI_API_KEY manquante dans .env");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  form.append("input_fidelity", "high");
  form.append("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "garment.jpg");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `OpenAI : ${json?.error?.message ?? res.statusText}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, "OpenAI n'a pas renvoyé d'image.");
  return Buffer.from(b64, "base64");
}
