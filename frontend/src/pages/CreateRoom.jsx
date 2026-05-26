import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CreateRoom() {
  const [links, setLinks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/create-room`, { method: "POST" });
      const data = await res.json();
      setLinks(data);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(text, key) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="logo-mark">✦</div>
        <h1 className="create-title">Clinical Scribe <span>v2</span></h1>
        <p className="create-sub">Video consultation with AI-powered clinical documentation.</p>
        {!links ? (
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? "Creating session…" : "Create Consultation Session"}
          </button>
        ) : (
          <div className="links-box">
            <p className="links-label">Session created. Share these links:</p>
            <div className="link-row">
              <div className="link-badge doctor">DOCTOR</div>
              <span className="link-text">{links.doctor_url}</span>
              <button className="btn-copy" onClick={() => copyLink(links.doctor_link, "doctor")}>
                {copied === "doctor" ? "✓" : "Copy"}
              </button>
            </div>
            <div className="link-row">
              <div className="link-badge patient">PATIENT</div>
              <span className="link-text">{links.patient_url}</span>
              <button className="btn-copy" onClick={() => copyLink(links.patient_link, "patient")}>
                {copied === "patient" ? "✓" : "Copy"}
              </button>
            </div>
            <button className="btn-secondary" onClick={() => { setLinks(null); }}>
              Create new session
            </button>
          </div>
        )}
        <p className="create-note">Each session generates a unique room. Links expire when the session ends.</p>
      </div>
    </div>
  );
}
