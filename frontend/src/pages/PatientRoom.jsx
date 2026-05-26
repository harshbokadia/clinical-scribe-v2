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
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [phase, setPhase] = useState("waiting");
  const [token, setToken] = useState(null);
  const [liveKitUrl, setLiveKitUrl] = useState(null);
  const [transcriptionPaused, setTranscriptionPaused] = useState(false);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const wsRef = useRef(null);

  function joinWaitingRoom() {
    if (!name.trim()) return;
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/ws/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", role: "patient", name }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "waiting") {
        setPhase("waiting");
        setNameSubmitted(true);
      } else if (msg.type === "admitted") {
        setToken(msg.token);
        setLiveKitUrl(msg.url);
        setPhase("admitted");
      } else if (msg.type === "transcription_status") {
        setTranscriptionActive(msg.active);
        setTranscriptionPaused(msg.paused);
      } else if (msg.type === "doctor_arrived") {
        setPhase("doctor_waiting");
      }
    };
  }

  if (!nameSubmitted) {
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
          />
          <button className="btn-primary" onClick={joinWaitingRoom} disabled={!name.trim()}>
            Join Session
          </button>
        </div>
      </div>
    );
  }

  if (phase === "waiting" || phase === "doctor_waiting") {
    return (
      <div className="waiting-page">
        <div className="waiting-card">
          <div className="waiting-pulse">
            <div className="pulse-ring" />
            <div className="pulse-ring delay" />
          </div>
          <h2 className="waiting-title">Waiting Room</h2>
          <p className="waiting-name">Hi, <strong>{name}</strong></p>
          <p className="waiting-msg">
            {phase === "doctor_waiting"
              ? "The doctor is ready. Waiting for admission…"
              : "Please wait. The doctor will admit you shortly."}
          </p>
          <p className="waiting-room-code">Room: {roomId}</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <div className="loading-screen"><div className="spinner" />Joining consultation…</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={liveKitUrl}
      token={token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={() => setPhase("waiting")}
    >
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
              <div className="paused-badge"><span>⏸</span> TRANSCRIPTION PAUSED</div>
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
