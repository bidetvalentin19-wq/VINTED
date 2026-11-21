import { useEffect, useState } from "react";
import { api } from "./api";
import type { AppConfig } from "./types";
import Dashboard from "./components/Dashboard";
import ListingEditor from "./components/ListingEditor";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get("annonce"));

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const url = openId ? `?annonce=${openId}` : location.pathname;
    history.replaceState(null, "", url);
  }, [openId]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setOpenId(null)}>
          <span className="brand-mark">V</span>
          <span>
            Vinted <strong>Studio</strong>
          </span>
        </button>
        {config && (
          <div className="status-pills">
            <span className={`pill ${config.claude ? "ok" : "warn"}`}>Claude {config.claude ? "connecté" : "non configuré"}</span>
            <span className={`pill ${config.providers.length ? "ok" : "warn"}`}>
              Studio IA {config.providers.length ? config.providers.join(" · ") : "non configuré"}
            </span>
          </div>
        )}
      </header>
      <main>
        {openId && config ? (
          <ListingEditor id={openId} config={config} onClose={() => setOpenId(null)} />
        ) : (
          <Dashboard onOpen={setOpenId} />
        )}
      </main>
    </div>
  );
}
