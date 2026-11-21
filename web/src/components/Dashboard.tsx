import { useEffect, useState } from "react";
import { api, photoUrl } from "../api";
import type { Listing } from "../types";
import DropZone from "./DropZone";

const STATUS_LABEL: Record<Listing["status"], string> = {
  draft: "Brouillon",
  ready: "Prête à publier",
  published: "En ligne",
};

export default function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Listing["status"]>("all");

  useEffect(() => {
    api.listings().then(setListings).catch((e) => setError(e.message));
  }, []);

  async function create(files: File[]) {
    setBusy(true);
    setError("");
    try {
      const l = await api.create(files);
      onOpen(l.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = (listings ?? []).filter((l) => filter === "all" || l.status === filter);
  const count = (s: Listing["status"]) => (listings ?? []).filter((l) => l.status === s).length;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Nouvelle annonce</h1>
          <p className="muted">
            Dépose 1 à 10 photos de ton vêtement, même prises vite fait. Le studio en fait des photos pro, Claude
            rédige l'annonce, l'extension la remplit sur Vinted.
          </p>
        </div>
        <DropZone onFiles={create} busy={busy} big label="Glisse tes photos ici ou clique pour choisir" />
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <div className="section-head">
          <h2>Mes annonces</h2>
          <div className="tabs small">
            {(["all", "draft", "ready", "published"] as const).map((f) => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? `Toutes (${listings?.length ?? 0})` : `${STATUS_LABEL[f]} (${count(f)})`}
              </button>
            ))}
          </div>
        </div>
        {listings === null ? (
          <p className="muted">Chargement…</p>
        ) : shown.length === 0 ? (
          <p className="empty">Aucune annonce pour l'instant.</p>
        ) : (
          <div className="grid">
            {shown.map((l) => {
              const cover = l.photos.find((p) => p.selected) ?? l.photos[0];
              return (
                <button key={l.id} className="card" onClick={() => onOpen(l.id)}>
                  <div className="card-img">
                    {cover ? <img src={photoUrl(l, cover)} alt="" loading="lazy" /> : <div className="noimg" />}
                    <span className={`badge ${l.status}`}>{STATUS_LABEL[l.status]}</span>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{l.details.title || "Sans titre"}</div>
                    <div className="card-meta">
                      <span>{l.details.brand || "—"}</span>
                      <strong>{l.details.price != null ? `${l.details.price} €` : ""}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
