// Préréglages du "Studio IA". Les prompts sont en anglais (meilleurs résultats
// avec les modèles d'image) ; les libellés sont affichés en français.

export interface Preset {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

// Clause commune : le vêtement doit rester strictement identique. C'est
// essentiel sur Vinted (une photo trompeuse = litige / retour).
export const FIDELITY_CLAUSE = `
CRITICAL - garment fidelity: the clothing item must stay EXACTLY the same item as in the input photo.
Keep identical: color and shade, pattern, print, logos, text, labels, stitching, seams, buttons, zips,
pockets, cut, length, proportions, fabric texture and sheen, and any visible wear, pilling or defects.
Do not add, remove, redesign or "improve" any detail of the garment. Do not change its color.
Only change the presentation: background, lighting, pose/shape, framing and camera quality.
No text, no watermark, no logo overlay, no frame, no collage: a single photograph.`.trim();

const QUALITY = `Ultra-realistic professional e-commerce fashion photography, shot on a full-frame camera with a
85mm lens, soft diffused studio lighting with large softboxes, accurate true-to-life colors, crisp focus on the
fabric texture, high dynamic range, clean and premium look. Vertical 3:4 framing with the whole garment visible
and centered with comfortable margins.`.replace(/\s+/g, " ");

export const PRESETS: Preset[] = [
  {
    id: "packshot",
    label: "Packshot fond blanc",
    description: "Le classique e-commerce : vêtement mis en forme, fond blanc pur, ombre douce.",
    prompt: `Turn this photo into a premium e-commerce packshot of the garment. Remove the original background,
hand, hanger, bed, floor and any clutter. Neatly reshape the garment so it looks freshly ironed and well
presented (no creases from being bundled), viewed from the front, on a seamless pure white (#FFFFFF) studio
background with a very soft natural contact shadow beneath it. ${QUALITY}`,
  },
  {
    id: "ghost",
    label: "Mannequin invisible",
    description: "Effet 3D « ghost mannequin » : le vêtement prend la forme d'un corps, sans personne.",
    prompt: `Transform this photo into a professional "ghost mannequin" (invisible mannequin) product photo:
the garment is shown with a natural 3D body volume as if worn by an invisible person, with the inner back
neckline visible where relevant, perfectly symmetrical, front view, on a seamless light grey-white studio
background (#F4F4F4) with a soft shadow. No person, no mannequin, no hanger visible. ${QUALITY}`,
  },
  {
    id: "flatlay",
    label: "Flat lay soigné",
    description: "Vue du dessus, vêtement parfaitement plié/étalé sur une surface claire et élégante.",
    prompt: `Create a high-end top-down flat lay photograph of this garment, laid perfectly flat and neatly
arranged (sleeves and legs placed symmetrically and elegantly), on a light warm off-white linen or matte paper
surface. Soft even daylight from a large window, subtle natural shadows. Minimal styling, nothing else in the
frame except possibly a very discreet neutral prop at the edge that does not overlap the garment. ${QUALITY}`,
  },
  {
    id: "model",
    label: "Porté par un modèle",
    description: "Le vêtement porté par un mannequin réaliste, cadrage mode, visage hors-champ.",
    prompt: `Create a realistic professional fashion catalogue photo of a model wearing exactly this garment.
The model has a natural, neutral pose, standing in a bright minimal studio with a light neutral background.
Frame the shot so the garment is the hero and fully visible; crop the face at the chin or show it out of focus
so attention stays on the clothing. Choose simple neutral complementary pieces (plain jeans or trousers, plain
top) that do not distract from the garment. The garment must fit naturally with correct drape. ${QUALITY}`,
  },
  {
    id: "hanger",
    label: "Cintre & mur minimaliste",
    description: "Sur un cintre en bois devant un mur clair, lumière naturelle, ambiance boutique.",
    prompt: `Create a stylish boutique-style photo of this garment hanging neatly on a natural wooden hanger
against a clean warm-white plaster wall, soft natural window light from the side creating gentle shadows,
maybe a subtle green plant leaf at the very edge of the frame. Garment perfectly smoothed, front view.
${QUALITY}`,
  },
  {
    id: "lifestyle",
    label: "Lifestyle / ambiance",
    description: "Mise en scène inspirante (chaise design, parquet clair) qui donne envie.",
    prompt: `Create an aspirational lifestyle product photo of this garment, casually but neatly draped over a
minimalist designer chair or laid on a bright Scandinavian interior setting with light oak floor, soft
morning daylight, warm and inviting mood, shallow depth of field. The garment remains the clear focus and is
fully recognizable. ${QUALITY}`,
  },
];

export function buildPrompt(presetId: string, extra?: string, gender?: string): string {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Préréglage inconnu : ${presetId}`);
  let prompt = preset.prompt.replace(/\s+/g, " ");
  if (presetId === "model" && gender) {
    const g = gender === "homme" ? "a male model" : gender === "enfant" ? "a child model" : "a female model";
    prompt += ` Use ${g}.`;
  }
  if (extra?.trim()) prompt += ` Additional instruction from the seller: ${extra.trim()}`;
  return `${prompt}\n\n${FIDELITY_CLAUSE}`;
}
