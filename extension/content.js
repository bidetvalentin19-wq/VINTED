// Panneau flottant sur la page « Vendre un article » de Vinted.
// Il remplit photos, titre, description et prix, et affiche le reste (catégorie,
// marque, taille, état…) à reporter en deux clics. Tu gardes la main : c'est toi
// qui vérifies et cliques sur « Ajouter ».
(() => {
  const PANEL_ID = "vs-panel";
  const isSellPage = () => /\/items\/new|\/items\/\d+\/edit/.test(location.pathname);

  const send = (type, payload = {}) =>
    new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ type, ...payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        res?.ok ? resolve(res.data) : reject(new Error(res?.error || "Erreur inconnue"));
      }),
    );

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Recherche des champs du formulaire Vinted ----------
  // Plusieurs sélecteurs par champ : Vinted change parfois son HTML.
  const FIELDS = {
    title: ['[data-testid="title--input"]', "input#title", 'input[name="title"]'],
    description: ['[data-testid="description--input"]', "textarea#description", 'textarea[name="description"]'],
    price: ['[data-testid="price-input--input"]', "input#price", 'input[name="price"]'],
  };
  const LABELS = { title: /^titre|^title/i, description: /^d[ée]cri|^description/i, price: /^prix|^price/i };

  function findField(key) {
    for (const sel of FIELDS[key]) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    for (const label of document.querySelectorAll("label")) {
      if (LABELS[key].test(label.textContent.trim())) {
        const el = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input,textarea");
        if (el) return el;
      }
    }
    return null;
  }

  // Les champs Vinted sont des composants React : il faut passer par le setter natif.
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  async function dataUrlToFile(dataUrl, name) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }

  async function fillPhotos(dataUrls) {
    const input = [...document.querySelectorAll('input[type="file"]')].find(
      (i) => !i.accept || /image|jpe?g|png/i.test(i.accept),
    );
    if (!input) return false;
    const files = await Promise.all(dataUrls.map((u, i) => dataUrlToFile(u, `photo-${i + 1}.jpg`)));
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ---------- Panneau ----------
  function panel() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = PANEL_ID;
    el.innerHTML = `
      <div class="vs-head"><strong>Vinted Studio</strong><button class="vs-min" title="Réduire">–</button></div>
      <div class="vs-body"><p class="vs-muted">Chargement…</p></div>`;
    document.body.appendChild(el);
    el.querySelector(".vs-min").addEventListener("click", () => el.classList.toggle("vs-collapsed"));
    return el;
  }

  async function showList() {
    const body = panel().querySelector(".vs-body");
    body.innerHTML = `<p class="vs-muted">Chargement des annonces…</p>`;
    try {
      const items = await send("list");
      if (!items.length) {
        body.innerHTML = `<p class="vs-muted">Aucune annonce prête. Prépare-en une dans l'appli Vinted Studio.</p>`;
        return;
      }
      body.innerHTML = `<p class="vs-muted">Choisis l'annonce à mettre en ligne :</p>` +
        items
          .map(
            (i) => `<div class="vs-item ${i.status === "published" ? "vs-done" : ""}">
              <div><div class="vs-title">${esc(i.title || "Sans titre")}</div>
              <div class="vs-muted">${i.count} photo(s) · ${i.price ?? "?"} € ${i.status === "published" ? "· déjà publiée" : ""}</div></div>
              <button data-id="${esc(i.id)}">Remplir</button></div>`,
          )
          .join("");
      body.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => fill(b.dataset.id)));
    } catch (e) {
      body.innerHTML = `<p class="vs-error">Impossible de joindre Vinted Studio.<br>Lance l'appli (<code>npm run dev</code>) puis recharge la page.</p><p class="vs-muted">${esc(e.message)}</p>`;
    }
  }

  async function fill(id) {
    const body = panel().querySelector(".vs-body");
    body.innerHTML = `<p class="vs-muted">Récupération des photos…</p>`;
    try {
      const data = await send("export", { id });
      const d = data.details;
      const report = [];
      report.push(["Photos", await fillPhotos(data.photos)]);
      // Petit délai : Vinted re-rend parfois le formulaire après l'ajout des photos.
      await new Promise((r) => setTimeout(r, 600));
      for (const [key, label, value] of [
        ["title", "Titre", d.title],
        ["description", "Description", d.description],
        ["price", "Prix", d.price != null ? String(d.price) : ""],
      ]) {
        const el = findField(key);
        if (el && value) setValue(el, value);
        report.push([label, Boolean(el && value)]);
      }

      const manual = [
        ["Catégorie", d.category],
        ["Marque", d.brand],
        ["Taille", d.size],
        ["État", d.condition],
        ["Couleur", (d.colors || []).join(", ")],
        ["Matière", (d.materials || []).join(", ")],
        ["Colis", d.parcelSize],
      ].filter(([, v]) => v);

      body.innerHTML = `
        <div class="vs-report">${report
          .map(([k, ok]) => `<span class="${ok ? "vs-ok" : "vs-ko"}">${ok ? "✓" : "✗"} ${k}</span>`)
          .join("")}</div>
        ${report.some(([, ok]) => !ok) ? `<p class="vs-muted">Les champs en ✗ n'ont pas été trouvés : utilise les boutons ci-dessous pour copier/coller.</p>` : ""}
        <p class="vs-muted">À sélectionner dans le formulaire :</p>
        <div class="vs-fields">${manual
          .map(([k, v]) => `<div class="vs-field"><span>${esc(k)}</span><b>${esc(v)}</b><button data-copy="${esc(v)}">Copier</button></div>`)
          .join("")}
          <div class="vs-field"><span>Titre</span><b>${esc(d.title)}</b><button data-copy="${esc(d.title)}">Copier</button></div>
          <div class="vs-field"><span>Description</span><b>…</b><button data-copy="${esc(d.description)}">Copier</button></div>
        </div>
        <p class="vs-muted">Vérifie tout, clique sur « Ajouter » sur Vinted, puis :</p>
        <button class="vs-primary" id="vs-published">C'est publié ✓</button>
        <button class="vs-link" id="vs-back">← Autre annonce</button>`;
      body.querySelectorAll("[data-copy]").forEach((b) =>
        b.addEventListener("click", async () => {
          await navigator.clipboard.writeText(b.dataset.copy);
          b.textContent = "Copié ✓";
          setTimeout(() => (b.textContent = "Copier"), 1200);
        }),
      );
      body.querySelector("#vs-back").addEventListener("click", showList);
      body.querySelector("#vs-published").addEventListener("click", async () => {
        await send("markPublished", { id });
        body.innerHTML = `<p class="vs-ok">Annonce marquée comme publiée dans Vinted Studio. Bonne vente !</p><button class="vs-link" id="vs-back2">← Autre annonce</button>`;
        body.querySelector("#vs-back2").addEventListener("click", showList);
      });
    } catch (e) {
      body.innerHTML = `<p class="vs-error">${esc(e.message)}</p><button class="vs-link" id="vs-back">← Retour</button>`;
      body.querySelector("#vs-back").addEventListener("click", showList);
    }
  }

  // Vinted est une application monopage : on surveille les changements d'URL.
  let last = "";
  function sync() {
    if (location.href === last) return;
    last = location.href;
    const existing = document.getElementById(PANEL_ID);
    if (isSellPage()) {
      if (!existing) showList();
    } else if (existing) existing.remove();
  }
  sync();
  setInterval(sync, 1000);
})();
