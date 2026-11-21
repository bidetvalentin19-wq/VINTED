// Service worker : il fait les appels vers l'appli locale (le script de page ne peut pas).
const DEFAULT_SERVER = "http://localhost:3000";

async function server() {
  const { serverUrl } = await chrome.storage.sync.get("serverUrl");
  return (serverUrl || DEFAULT_SERVER).replace(/\/$/, "");
}

async function getJson(path, init) {
  const res = await fetch((await server()) + path, init);
  if (!res.ok) throw new Error(`Erreur ${res.status} depuis Vinted Studio`);
  return res.json();
}

async function toDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;
}

const handlers = {
  async list() {
    const all = await getJson("/api/listings");
    return all
      .filter((l) => l.status !== "draft" || l.details.title)
      .map((l) => ({ id: l.id, title: l.details.title, price: l.details.price, status: l.status, count: l.photos.filter((p) => p.selected).length }));
  },
  async export({ id }) {
    const data = await getJson(`/api/listings/${id}/export`);
    const photos = [];
    for (const url of data.photos.slice(0, 20)) photos.push(await toDataUrl(url));
    return { ...data, photos };
  },
  async markPublished({ id }) {
    return getJson(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
  },
  async server() {
    return server();
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const fn = handlers[msg?.type];
  if (!fn) return false;
  fn(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true; // réponse asynchrone
});
