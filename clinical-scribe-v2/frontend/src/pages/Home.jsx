import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Home() {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  async function createRoom() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/create-room`, { method: "POST" });
      const data = await res.json();
      setRoom(data);
    } catch (err) {
      alert("Failed to create room. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  function copyLink(type, url) {
    navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="home">
      <div className="home-card">
        <div className="logo-mark">✦</div>
        <h1 className="home-title">Clinical Scribe V2</h1>
        <p className="home-sub">
          Video consultations with AI-powered clinical documentation.
          Create a session to get started.
        </p>
        {!room ? (
          <button className="btn-primary" onClick={createRoom} disabled={loading}>
            {loading ? "Creating session…" : "Create Consultation Session"}
          </button>
        ) : (
          <div className="room-links">
            <div className="room-id-badge">Session ID: {room.room_id}</div>
            <div className="link-card link-doctor">
              <div className="link-role">
                <span className="link-icon">👨‍⚕️</span>
                <span className="link-label">Doctor Link</span>
              </div>
              <p className="link-desc">Full controls — admit patient, start/pause/stop transcription, edit note.</p>
              <div className="link-row">
                <input className="link-input" readOnly value={room.doctor_url} />
                <button
                  className="btn-copy"
                  onClick={() => copyLink("doctor", room.doctor_url)}
                >
                  {copied === "doctor" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="link-card link-patient">
              <div className="link-role">
                <span className="link-icon">🧑</span>
                <span className="link-label">Patient Link</span>
              </div>
              <p className="link-desc">Join the consultation. Wait in the lobby until the doctor admits you.</p>
              <div className="link-row">
                <input className="link-input" readOnly value={room.patient_url} />
                <button
                  className="btn-copy"
                  onClick={() => copyLink("patient", room.patient_url)}
                >
                  {copied === "patient" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <button className="btn-secondary" onClick={() => setRoom(null)}>
              Create New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
