import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { AppConfig, Listing } from "../types";
import StudioStep from "./StudioStep";
import DetailsStep from "./DetailsStep";
import PublishStep from "./PublishStep";

const STEPS = [
  { id: "studio", label: "1. Studio photo" },
  { id: "details", label: "2. Annonce" },
  { id: "publish", label: "3. Publier sur Vinted" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export default function ListingEditor({ id, config, onClose }: { id: string; config: AppConfig; onClose: () => void }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [step, setStep] = useState<StepId>("studio");
  const [error, setError] = useState("");

  useEffect(() => {
    api.listing(id).then(setListing).catch((e) => setError(e.message));
  }, [id]);

  const patch = useCallback(
    async (p: Record<string, unknown>) => {
      const l = await api.update(id, p);
      setListing(l);
      return l;
    },
    [id],
  );

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!listing) return <div className="page"><p className="muted">Chargement…</p></div>;

  return (
    <div className="page editor">
      <div className="editor-head">
        <button className="ghost" onClick={onClose}>← Mes annonces</button>
        <h1>{listing.details.title || "Nouvelle annonce"}</h1>
        <button
          className="ghost danger"
          onClick={async () => {
            if (confirm("Supprimer définitivement cette annonce et ses photos ?")) {
              await api.remove(listing.id);
              onClose();
            }
          }}
        >
          Supprimer
        </button>
      </div>
      <nav className="steps">
        {STEPS.map((s) => (
          <button key={s.id} className={step === s.id ? "active" : ""} onClick={() => setStep(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>
      {step === "studio" && (
        <StudioStep listing={listing} config={config} setListing={setListing} patch={patch} onNext={() => setStep("details")} />
      )}
      {step === "details" && (
        <DetailsStep listing={listing} config={config} setListing={setListing} patch={patch} onNext={() => setStep("publish")} />
      )}
      {step === "publish" && <PublishStep listing={listing} patch={patch} />}
    </div>
  );
}
