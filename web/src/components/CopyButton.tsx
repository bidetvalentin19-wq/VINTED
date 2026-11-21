import { useState } from "react";

export default function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      className="copy"
      onClick={async (e) => {
        e.preventDefault();
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? "Copié ✓" : label}
    </button>
  );
}
