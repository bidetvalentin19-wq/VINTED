import { useEffect, useMemo, useState } from "react";
import { api, photoUrl } from "../api";
import { removeBackground } from "../bgRemoval";
import type { AppConfig, Listing, Photo } from "../types";
import CompareSlider from "./CompareSlider";
import DropZone from "./DropZone";

interface Props {
  listing: Listing;
  config: AppConfig;
  setListing: (l: Listing) => void;
  patch: (p: Record<string, unknown>) => Promise<Listing>;
  onNext: () => void;
}

type Job = { key: string; sourceId: string; label: string; error?: string };

const KIND_LABEL: Record<Photo["kind"], string> = {
  original: "Originale",
  "studio-ai": "Studio IA",
  "studio-local": "Studio local",
  enhanced: "Retouche",
};

export default function StudioStep({ listing, config, setListing, patch, onNext }: Props) {
  const originals = listing.photos.filter((p) => p.kind === "original");
  const [sourceId, setSourceId] = useState(originals[0]?.id ?? "");
  const [viewId, setViewId] = useState<string | null>(null);
  const [tool, setTool] = useState<"ai" | "local" | "quick">(config.providers.length ? "ai" : "local");
  const [presets, setPresets] = useState<string[]>(["packshot", "ghost"]);
  const [provider, setProvider] = useState<string>(config.providers[0] ?? "");
  const [extra, setExtra] = useState("");
  const [bg, setBg] = useState("white");
  const [shadow, setShadow] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [progress, setProgress] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!originals.some((o) => o.id === sourceId)) setSourceId(originals[0]?.id ?? "");
  }, [originals, sourceId]);

  const source = listing.photos.find((p) => p.id === sourceId);
  const results = listing.photos.filter((p) => p.sourceId === sourceId);
  const viewed = listing.photos.find((p) => p.id === viewId && p.sourceId === sourceId) ?? results[results.length - 1];
  const selected = useMemo(() => listing.photos.filter((p) => p.selected), [listing.photos]);
  const running = jobs.filter((j) => !j.error);

  async function runJob(label: string, fn: () => Promise<{ photo: Photo; listing: Listing }>) {
    const key = Math.random().toString(36).slice(2);
    setJobs((j) => [...j, { key, sourceId, label }]);
    try {
      const res = await fn();
      setListing(res.listing);
      setViewId(res.photo.id);
      setJobs((j) => j.filter((x) => x.key !== key));
    } catch (e) {
      setJobs((j) => j.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
    }
  }

  async function generateAI() {
    if (!source) return;
    // Lancées en parallèle : chaque rendu apparaît dès qu'il est prêt.
    await Promise.all(
      presets.map((preset) => {
        const label = config.presets.find((p) => p.id === preset)?.label ?? preset;
        return runJob(label, () => api.studio(listing.id, source.id, { preset, provider, extra }));
      }),
    );
  }

  async function generateLocal() {
    if (!source) return;
    await runJob("Détourage", async () => {
      const cutout = await removeBackground(photoUrl(listing, source), setProgress);
      setProgress("Composition du packshot…");
      try {
        return await api.compose(listing.id, source.id, cutout, bg, shadow);
      } finally {
        setProgress("");
      }
    });
  }

  async function togglePhoto(p: Photo) {
    await patch({ photoSelected: { [p.id]: !p.selected } });
  }

  async function move(p: Photo, dir: -1 | 1) {
    const order = selected.map((x) => x.id);
    const i = order.indexOf(p.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    await patch({ photoOrder: [...order, ...listing.photos.filter((x) => !x.selected).map((x) => x.id)] });
  }

  async function makeCover(p: Photo) {
    await patch({ photoOrder: [p.id, ...listing.photos.filter((x) => x.id !== p.id).map((x) => x.id)] });
  }

  async function remove(p: Photo) {
    if (!confirm("Supprimer cette photo ?")) return;
    setListing(await api.deletePhoto(listing.id, p.id));
  }

  return (
    <div className="studio">
      <aside className="sources">
        <h3>Photos d'origine</h3>
        <div className="source-list">
          {originals.map((p) => (
            <button
              key={p.id}
              className={`thumb ${p.id === sourceId ? "active" : ""}`}
              onClick={() => {
                setSourceId(p.id);
                setViewId(null);
              }}
            >
              <img src={photoUrl(listing, p)} alt="" />
              <span className="thumb-count">{listing.photos.filter((x) => x.sourceId === p.id).length || ""}</span>
            </button>
          ))}
        </div>
        <DropZone
          busy={uploading}
          label="Ajouter"
          onFiles={async (files) => {
            setUploading(true);
            try {
              setListing(await api.addPhotos(listing.id, files));
            } finally {
              setUploading(false);
            }
          }}
        />
        <p className="tip">
          Astuce : une photo par angle (face, dos, étiquette, matière, défauts). Lumière du jour, vêtement à plat ou
          sur cintre.
        </p>
      </aside>

      <section className="stage">
        {!source ? (
          <div className="empty">Ajoute une photo pour commencer.</div>
        ) : viewed ? (
          <CompareSlider before={photoUrl(listing, source)} after={photoUrl(listing, viewed)} />
        ) : (
          <div className="stage-single">
            <img src={photoUrl(listing, source)} alt="" />
          </div>
        )}
        {source && (
          <div className="results">
            {results.map((p) => (
              <button key={p.id} className={`result ${viewed?.id === p.id ? "active" : ""}`} onClick={() => setViewId(p.id)}>
                <img src={photoUrl(listing, p)} alt="" />
                <span>{p.label}</span>
              </button>
            ))}
            {jobs
              .filter((j) => j.sourceId === sourceId)
              .map((j) => (
                <div key={j.key} className={`result pending ${j.error ? "failed" : ""}`} title={j.error}>
                  {j.error ? (
                    <>
                      <span className="fail-icon">!</span>
                      <span>Échec</span>
                      <button className="link" onClick={() => setJobs((x) => x.filter((y) => y.key !== j.key))}>
                        fermer
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="spinner" />
                      <span>{j.label}…</span>
                    </>
                  )}
                </div>
              ))}
          </div>
        )}
        {jobs.some((j) => j.error) && (
          <p className="error small">{jobs.find((j) => j.error)?.error}</p>
        )}
      </section>

      <aside className="tools">
        <div className="tabs">
          <button className={tool === "ai" ? "active" : ""} onClick={() => setTool("ai")}>Studio IA</button>
          <button className={tool === "local" ? "active" : ""} onClick={() => setTool("local")}>Détourage</button>
          <button className={tool === "quick" ? "active" : ""} onClick={() => setTool("quick")}>Retouche</button>
        </div>

        {tool === "ai" && (
          <div className="tool-body">
            {config.providers.length === 0 ? (
              <p className="warn-box">
                Ajoute <code>GEMINI_API_KEY</code> ou <code>OPENAI_API_KEY</code> dans le fichier <code>.env</code> puis
                redémarre l'appli pour activer le Studio IA.
              </p>
            ) : (
              <>
                <p className="muted small">Choisis un ou plusieurs rendus. Le vêtement est conservé à l'identique.</p>
                <div className="preset-list">
                  {config.presets.map((p) => (
                    <label key={p.id} className={`preset ${presets.includes(p.id) ? "on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={presets.includes(p.id)}
                        onChange={(e) =>
                          setPresets((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))
                        }
                      />
                      <div>
                        <strong>{p.label}</strong>
                        <span>{p.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {presets.includes("model") && (
                  <label className="field">
                    <span>Mannequin</span>
                    <select
                      value={listing.hints.gender ?? "femme"}
                      onChange={(e) => patch({ hints: { gender: e.target.value } })}
                    >
                      <option value="femme">Femme</option>
                      <option value="homme">Homme</option>
                      <option value="enfant">Enfant</option>
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Consigne en plus (facultatif)</span>
                  <input
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="ex : manches retroussées, fond plus chaud…"
                  />
                </label>
                {config.providers.length > 1 && (
                  <label className="field">
                    <span>Moteur</span>
                    <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                      {config.providers.map((p) => (
                        <option key={p} value={p}>
                          {p === "gemini" ? "Google Gemini" : "OpenAI"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button className="primary wide" disabled={!source || presets.length === 0} onClick={generateAI}>
                  Générer {presets.length > 1 ? `${presets.length} photos` : "la photo"}
                </button>
              </>
            )}
          </div>
        )}

        {tool === "local" && (
          <div className="tool-body">
            <p className="muted small">
              Détourage automatique dans ton navigateur (gratuit, hors ligne après le 1er chargement), puis packshot
              sur fond studio avec ombre douce. Couleurs du vêtement inchangées.
            </p>
            <div className="bg-list">
              {config.backgrounds.map((b) => (
                <button
                  key={b.id}
                  className={`bg-swatch ${bg === b.id ? "on" : ""}`}
                  style={{ background: b.color }}
                  onClick={() => setBg(b.id)}
                  title={b.label}
                >
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} /> Ombre portée
            </label>
            <button className="primary wide" disabled={!source || running.length > 0} onClick={generateLocal}>
              Détourer et composer
            </button>
            {progress && <p className="muted small">{progress}</p>}
          </div>
        )}

        {tool === "quick" && (
          <div className="tool-body">
            <p className="muted small">
              Corrige l'exposition, la balance des blancs (de façon bridée pour garder la vraie couleur), la netteté
              et recadre au format Vinted 3:4. Idéal pour les photos d'étiquette et de défauts.
            </p>
            <button
              className="primary wide"
              disabled={!source}
              onClick={() => runJob("Retouche", () => api.enhance(listing.id, source!.id))}
            >
              Retoucher cette photo
            </button>
          </div>
        )}
      </aside>

      <section className="selection">
        <div className="section-head">
          <h3>
            Photos de l'annonce <span className="muted">({selected.length}/20 · la 1re est la couverture)</span>
          </h3>
          <button className="primary" onClick={onNext}>
            Continuer → Annonce
          </button>
        </div>
        <div className="strip">
          {selected.map((p, i) => (
            <div key={p.id} className="strip-item">
              <img src={photoUrl(listing, p)} alt="" onClick={() => p.sourceId && (setSourceId(p.sourceId), setViewId(p.id))} />
              {i === 0 && <span className="cover">Couverture</span>}
              <span className={`kind ${p.kind}`}>{KIND_LABEL[p.kind]}</span>
              <div className="strip-actions">
                <button onClick={() => move(p, -1)} disabled={i === 0} title="Avancer">‹</button>
                <button onClick={() => makeCover(p)} disabled={i === 0} title="Mettre en couverture">★</button>
                <button onClick={() => move(p, 1)} disabled={i === selected.length - 1} title="Reculer">›</button>
                <button onClick={() => togglePhoto(p)} title="Retirer de l'annonce">✕</button>
              </div>
            </div>
          ))}
        </div>
        {listing.photos.some((p) => !p.selected) && (
          <>
            <h4 className="muted">Non utilisées</h4>
            <div className="strip dim">
              {listing.photos
                .filter((p) => !p.selected)
                .map((p) => (
                  <div key={p.id} className="strip-item">
                    <img src={photoUrl(listing, p)} alt="" />
                    <span className={`kind ${p.kind}`}>{KIND_LABEL[p.kind]}</span>
                    <div className="strip-actions">
                      <button onClick={() => togglePhoto(p)} title="Ajouter à l'annonce">＋</button>
                      <button onClick={() => remove(p)} title="Supprimer">🗑</button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
        {selected.length > 0 && !selected.some((p) => p.kind === "original" || p.kind === "enhanced") && (
          <p className="warn-box">
            Conseil : garde au moins une vraie photo (ou une retouche) en plus des rendus studio, surtout pour
            l'étiquette et les éventuels défauts. Les acheteurs Vinted et les règles de la plateforme l'attendent.
          </p>
        )}
      </section>
    </div>
  );
}
