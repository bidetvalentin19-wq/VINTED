import { useRef, useState } from "react";

/** Comparateur avant / après : on fait glisser la poignée. */
export default function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div
      className="compare"
      ref={box}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <img src={after} alt="Après" draggable={false} />
      <div className="compare-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="Avant" draggable={false} />
      </div>
      <div className="compare-handle" style={{ left: `${pos}%` }}>
        <span>⟷</span>
      </div>
      <span className="compare-tag left">Avant</span>
      <span className="compare-tag right">Après</span>
    </div>
  );
}
