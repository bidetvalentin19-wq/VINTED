const input = document.getElementById("url");
const msg = document.getElementById("msg");
chrome.storage.sync.get("serverUrl").then(({ serverUrl }) => (input.value = serverUrl || "http://localhost:3000"));
document.getElementById("save").addEventListener("click", async () => {
  const url = input.value.trim() || "http://localhost:3000";
  await chrome.storage.sync.set({ serverUrl: url });
  try {
    const res = await fetch(url.replace(/\/$/, "") + "/api/config");
    msg.textContent = res.ok ? "Connecté ✓" : "L'appli répond mais avec une erreur.";
  } catch {
    msg.textContent = "Impossible de joindre l'appli. Est-elle lancée (npm run dev) ?";
  }
});
