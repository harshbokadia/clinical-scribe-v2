import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import SessionTimer from "../components/SessionTimer.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function PatientRoom() {
  const { roomId } = useParams();
  const [name, setName] = useState("");
  const [token, setToken] = useState(null);
  const [lkUrl, setLkUrl] = useState(null);
  const [joining, setJoining] = useState(false);
  const [admitted, setAdmitted] = useState(false);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [transcriptionPaused, setTranscriptionPaused] = useState(false);
  const wsRef = useRef(null);

  async function joinWaitingRoom() {
    if (!name.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`${API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, role: "patient", name: name.trim() }),
      });
      if (!res.ok) throw new Error("Failed to get token.");
      const data = await res.json();
      setLkUrl(data.url);
      setToken(data.token);
      connectWebSocket();
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  }

  function connectWebSocket() {
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/ws/${roomId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "patient_admitted") setAdmitted(true);
      if (msg.type === "transcription_state") {
        setTranscriptionPaused(msg.state === "paused");
        setTranscriptionActive(msg.state !== "stopped");
      }
    };
  }

  if (!token) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="logo-mark">✦</div>
          <h2 className="join-title">Join Consultation</h2>
          <p className="join-sub">Room: <span className="room-code">{roomId}</span></p>
          <input
            className="name-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinWaitingRoom()}
            autoFocus
          />
          <button className="btn-primary" onClick={joinWaitingRoom} disabled={!name.trim() || joining}>
            {joining ? "Connecting…" : "Join Session"}
          </button>
        </div>
      </div>
    );
  }

  if (!admitted) {
    return (
      <div className="waiting-page">
        <div className="waiting-card">
          <div className="waiting-pulse">
            <div className="pulse-ring" />
            <div className="pulse-ring delay" />
          </div>
          <h2 className="waiting-title">Waiting Room</h2>
          <p className="waiting-name">Hi, <strong>{name}</strong></p>
          <p className="waiting-msg">Please wait. The doctor will admit you shortly.</p>
          <p className="waiting-room-code">Room: {roomId}</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={lkUrl} token={token} connect audio video onDisconnected={() => setAdmitted(false)}>
      <RoomAudioRenderer />
      <div className="room-layout">
        <header className="room-header">
          <div className="header-left">
            <span className="logo-small">✦</span>
            <span className="header-title">Clinical Scribe v2</span>
            <span className="divider">|</span>
            <span className="header-room">{name}</span>
          </div>
          <div className="header-center">
            <SessionTimer running={transcriptionActive && !transcriptionPaused} />
            {transcriptionActive && !transcriptionPaused && (
              <div className="recording-badge"><span className="recording-dot" /> RECORDING</div>
            )}
            {transcriptionPaused && (
              <div className="paused-badge">⏸ TRANSCRIPTION PAUSED</div>
            )}
          </div>
          <div className="header-right" />
        </header>
        <div className="video-full">
          <VideoConference />
        </div>
      </div>
    </LiveKitRoom>
  );
}