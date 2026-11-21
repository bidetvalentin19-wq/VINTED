// Détourage 100 % local dans le navigateur (gratuit, rien n'est envoyé à un service).
// Le modèle (~40 Mo) est téléchargé une seule fois puis mis en cache par le navigateur.
const cache = new Map<string, Blob>();

export async function removeBackground(imageUrl: string, onProgress?: (msg: string) => void): Promise<Blob> {
  const hit = cache.get(imageUrl);
  if (hit) return hit;
  const { removeBackground: run } = await import("@imgly/background-removal");
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Photo introuvable");
  const blob = await run(await res.blob(), {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 1 },
    progress: (key: string, current: number, total: number) => {
      if (key.startsWith("fetch")) onProgress?.(`Téléchargement du modèle… ${Math.round((current / total) * 100)} %`);
      else onProgress?.("Détourage en cours…");
    },
  });
  cache.set(imageUrl, blob);
  return blob;
}
