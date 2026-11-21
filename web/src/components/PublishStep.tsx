import { useState } from "react";
import { photoUrl } from "../api";
import type { Listing } from "../types";
import CopyButton from "./CopyButton";

export default function PublishStep({ listing, patch }: { listing: Listing; patch: (p: Record<string, unknown>) => Promise<Listing> }) {
  const photos = listing.photos.filter((p) => p.selected);
  const d = listing.details;
  const [current, setCurrent] = useState(0);
  const missing = [
    !photos.length && "photos",
    !d.title && "titre",
    !d.description && "description",
    !d.price && "prix",
  ].filter(Boolean);

  async function downloadAll() {
    for (const [i, p] of photos.entries()) {
      const a = document.createElement("a");
      a.href = photoUrl(listing, p);
      a.download = `${(d.title || "vinted").replace(/[^\w-]+/g, "_")}_${i + 1}.jpg`;
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return (
    <div className="publish">
      <section className="preview">
        <div className="preview-photo">
          {photos[current] && <img src={photoUrl(listing, photos[current])} alt="" />}
          <div className="preview-dots">
            {photos.map((p, i) => (
              <button key={p.id} className={i === current ? "on" : ""} onClick={() => setCurrent(i)} />
            ))}
          </div>
        </div>
        <div className="preview-info">
          <div className="preview-price">{d.price != null ? `${d.price.toFixed(2).replace(".", ",")} €` : "— €"}</div>
          <div className="preview-meta">
            {[d.size, d.condition, d.brand].filter(Boolean).join(" · ")}
          </div>
          <h2>{d.title || "Titre de l'annonce"}</h2>
          <p className="preview-desc">{d.description}</p>
          <dl>
            <dt>Catégorie</dt>
            <dd>{d.category || "—"}</dd>
            <dt>Couleur</dt>
            <dd>{d.colors.join(", ") || "—"}</dd>
            <dt>Matière</dt>
            <dd>{d.materials.join(", ") || "—"}</dd>
            <dt>Colis</dt>
            <dd>{d.parcelSize || "—"}</dd>
          </dl>
        </div>
      </section>

      <section className="panel">
        <h3>Mettre en ligne</h3>
        {missing.length > 0 && <p className="warn-box">Il manque : {missing.join(", ")}.</p>}

        <div className="method">
          <h4>Option 1 · Extension Chrome (recommandé, ~30 secondes)</h4>
          <ol>
            <li>
              Installe une fois l'extension : <code>chrome://extensions</code> → « Mode développeur » → « Charger
              l'extension non empaquetée » → dossier <code>extension/</code> du projet.
            </li>
            <li>
              Ouvre <a href="https://www.vinted.fr/items/new" target="_blank" rel="noreferrer">vinted.fr/items/new</a>{" "}
              (connecté à ton compte).
            </li>
            <li>
              Dans le panneau « Vinted Studio », clique sur <strong>Remplir</strong> pour cette annonce : photos, titre,
              description et prix sont remplis automatiquement.
            </li>
            <li>Complète catégorie, marque, taille, état (valeurs affichées dans le panneau), vérifie, puis publie.</li>
          </ol>
        </div>

        <div className="method">
          <h4>Option 2 · À la main</h4>
          <div className="manual">
            <button onClick={downloadAll} disabled={!photos.length}>Télécharger les {photos.length} photos</button>
            <CopyButton text={d.title} label="Copier le titre" />
            <CopyButton text={d.description} label="Copier la description" />
            <CopyButton text={d.price != null ? String(d.price) : ""} label="Copier le prix" />
          </div>
        </div>

        <div className="publish-status">
          {listing.status === "published" ? (
            <>
              <span className="badge published">En ligne</span>
              <button className="ghost" onClick={() => patch({ status: "ready" })}>Annuler</button>
            </>
          ) : (
            <button className="primary" onClick={() => patch({ status: "published" })}>
              J'ai publié l'annonce ✓
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
