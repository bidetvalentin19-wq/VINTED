import { useRef, useState } from "react";

export default function DropZone({
  onFiles,
  busy,
  big,
  label = "Ajouter des photos",
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  big?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`dropzone ${big ? "big" : ""} ${over ? "over" : ""} ${busy ? "busy" : ""}`}
      onClick={() => !busy && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) take(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="dz-icon">{busy ? <span className="spinner" /> : "＋"}</div>
      <div>{busy ? "Import en cours…" : label}</div>
      {big && <div className="muted small">JPG, PNG, HEIC · jusqu'à 30 Mo par photo</div>}
    </div>
  );
}
