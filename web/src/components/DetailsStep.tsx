import { useEffect, useState } from "react";
import { api } from "../api";
import { CONDITIONS, type AppConfig, type Listing, type ListingDetails } from "../types";
import CopyButton from "./CopyButton";

interface Props {
  listing: Listing;
  config: AppConfig;
  setListing: (l: Listing) => void;
  patch: (p: Record<string, unknown>) => Promise<Listing>;
  onNext: () => void;
}

const list = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export default function DetailsStep({ listing, config, setListing, patch, onNext }: Props) {
  const [hints, setHints] = useState(listing.hints);
  const [d, setD] = useState<ListingDetails>(listing.details);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setD(listing.details);
    setDirty(false);
  }, [listing.details]);

  const set = <K extends keyof ListingDetails>(k: K, v: ListingDetails[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  async function save() {
    if (dirty) await patch({ details: d });
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      if (dirty) await patch({ details: d });
      setListing(await api.analyze(listing.id, hints));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const titleLen = d.title.length;

  return (
    <div className="details">
      <section className="panel hints">
        <h3>Ce que tu sais du vêtement</h3>
        <p className="muted small">Facultatif, mais ça rend l'annonce plus précise. Tes infos priment sur l'IA.</p>
        <div className="row">
          <label className="field">
            <span>Rayon</span>
            <select value={hints.gender ?? ""} onChange={(e) => setHints({ ...hints, gender: e.target.value })}>
              <option value="">Auto</option>
              <option value="femme">Femmes</option>
              <option value="homme">Hommes</option>
              <option value="enfant">Enfants</option>
            </select>
          </label>
          <label className="field">
            <span>Marque</span>
            <input value={hints.brand ?? ""} onChange={(e) => setHints({ ...hints, brand: e.target.value })} placeholder="ex : Sézane" />
          </label>
          <label className="field">
            <span>Taille</span>
            <input value={hints.size ?? ""} onChange={(e) => setHints({ ...hints, size: e.target.value })} placeholder="ex : M / 38" />
          </label>
        </div>
        <label className="field">
          <span>Notes (état, défauts, matière, porté combien de fois…)</span>
          <textarea
            rows={3}
            value={hints.notes ?? ""}
            onChange={(e) => setHints({ ...hints, notes: e.target.value })}
            placeholder="ex : porté 3 fois, petite bouloche sous le bras gauche, 100 % laine mérinos"
          />
        </label>
        <button className="primary" onClick={generate} disabled={loading || !config.claude}>
          {loading ? (
            <>
              <span className="spinner" /> Claude analyse tes photos…
            </>
          ) : d.title ? (
            "Régénérer l'annonce avec Claude"
          ) : (
            "Rédiger l'annonce avec Claude"
          )}
        </button>
        {!config.claude && (
          <p className="warn-box">Ajoute <code>ANTHROPIC_API_KEY</code> dans <code>.env</code> pour la rédaction automatique.</p>
        )}
        {error && <p className="error">{error}</p>}
        {listing.aiNotes && (
          <div className="ai-notes">
            <strong>Conseils de Claude</strong>
            <p>{listing.aiNotes}</p>
          </div>
        )}
      </section>

      <section className="panel form" onBlur={save}>
        <div className="section-head">
          <h3>Annonce</h3>
          <span className="muted small">{dirty ? "Modifications non enregistrées" : "Enregistré"}</span>
        </div>
        <label className="field">
          <span>
            Titre <em className={titleLen > 60 ? "over" : ""}>{titleLen}/60</em> <CopyButton text={d.title} />
          </span>
          <input value={d.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field">
          <span>
            Description <em>{d.description.length}</em> <CopyButton text={d.description} />
          </span>
          <textarea rows={10} value={d.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="row">
          <label className="field">
            <span>Catégorie <CopyButton text={d.category} /></span>
            <input value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="Femmes > Vêtements > …" />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Marque <CopyButton text={d.brand} /></span>
            <input value={d.brand} onChange={(e) => set("brand", e.target.value)} />
          </label>
          <label className="field">
            <span>Taille</span>
            <input value={d.size} onChange={(e) => set("size", e.target.value)} />
          </label>
          <label className="field">
            <span>État</span>
            <select value={d.condition} onChange={(e) => set("condition", e.target.value)}>
              <option value="">—</option>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Couleurs (max 2)</span>
            <input value={d.colors.join(", ")} onChange={(e) => set("colors", list(e.target.value).slice(0, 2))} />
          </label>
          <label className="field">
            <span>Matières</span>
            <input value={d.materials.join(", ")} onChange={(e) => set("materials", list(e.target.value))} />
          </label>
          <label className="field">
            <span>Colis</span>
            <select value={d.parcelSize} onChange={(e) => set("parcelSize", e.target.value)}>
              <option value="">—</option>
              <option>Petit</option>
              <option>Moyen</option>
              <option>Grand</option>
            </select>
          </label>
        </div>
        <div className="price-row">
          <label className="field price">
            <span>Prix (€)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={d.price ?? ""}
              onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          {d.priceQuick != null && (
            <div className="price-chips">
              <span className="muted small">Suggestions :</span>
              <button className="chip" onClick={() => set("price", d.priceQuick)}>Vente rapide {d.priceQuick} €</button>
              {d.priceMax != null && (
                <button className="chip" onClick={() => set("price", d.priceMax)}>Haut {d.priceMax} €</button>
              )}
            </div>
          )}
        </div>
        {d.defects.length > 0 && (
          <div className="defects">
            <strong>Défauts repérés :</strong> {d.defects.join(" · ")}
            <span className="muted small"> — vérifie qu'ils sont bien mentionnés et visibles en photo.</span>
          </div>
        )}
        <div className="section-head">
          <span />
          <button
            className="primary"
            disabled={!d.title || !d.price}
            onClick={async () => {
              await patch({ details: d, status: listing.status === "published" ? "published" : "ready" });
              onNext();
            }}
          >
            Valider → Publier
          </button>
        </div>
      </section>
    </div>
  );
}
