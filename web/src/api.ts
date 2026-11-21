import type { AppConfig, Listing, Photo } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body as T;
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const filesForm = (files: File[] | FileList) => {
  const fd = new FormData();
  for (const f of Array.from(files)) fd.append("photos", f);
  return fd;
};

export const photoUrl = (l: Listing, p: Photo) => `/files/${l.id}/${p.file}`;

export const api = {
  config: () => req<AppConfig>("/api/config"),
  listings: () => req<Listing[]>("/api/listings"),
  listing: (id: string) => req<Listing>(`/api/listings/${id}`),
  create: (files: File[] | FileList) => req<Listing>("/api/listings", { method: "POST", body: filesForm(files) }),
  update: (id: string, patch: Record<string, unknown>) => req<Listing>(`/api/listings/${id}`, json("PATCH", patch)),
  remove: (id: string) => req<void>(`/api/listings/${id}`, { method: "DELETE" }),
  addPhotos: (id: string, files: File[] | FileList) =>
    req<Listing>(`/api/listings/${id}/photos`, { method: "POST", body: filesForm(files) }),
  deletePhoto: (id: string, pid: string) => req<Listing>(`/api/listings/${id}/photos/${pid}`, { method: "DELETE" }),
  studio: (id: string, pid: string, body: { preset: string; provider?: string; extra?: string }) =>
    req<{ photo: Photo; listing: Listing }>(`/api/listings/${id}/photos/${pid}/studio`, json("POST", body)),
  enhance: (id: string, pid: string) =>
    req<{ photo: Photo; listing: Listing }>(`/api/listings/${id}/photos/${pid}/enhance`, { method: "POST" }),
  compose: (id: string, pid: string, cutout: Blob, background: string, shadow: boolean) => {
    const fd = new FormData();
    fd.append("cutout", cutout, "cutout.png");
    fd.append("background", background);
    fd.append("shadow", String(shadow));
    return req<{ photo: Photo; listing: Listing }>(`/api/listings/${id}/photos/${pid}/compose`, {
      method: "POST",
      body: fd,
    });
  },
  analyze: (id: string, hints: Listing["hints"]) => req<Listing>(`/api/listings/${id}/analyze`, json("POST", { hints })),
};
