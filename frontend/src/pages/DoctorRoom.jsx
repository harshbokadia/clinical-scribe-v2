import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import SessionTimer from "../components/SessionTimer.jsx";
import NoteEditor from "../components/NoteEditor.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function DoctorRoom() {
  const { roomId } = useParams();
  const [name, setName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [token, setToken] = useState(null);
  const [liveKitUrl, setLiveKitUrl] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [transcriptionPaused, setTranscriptionPaused] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [note, setNote] = useState(null);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [phase, setPhase] = useState("consult");
  const wsRef = useRef(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  function joinSession() {
    if (!name.trim()) return;
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/ws/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", role: "doctor", name }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "doctor_joined") {
        setToken(msg.token);
        setLiveKitUrl(msg.url);
        setWaitingPatients(msg.waiting || []);
        setTranscriptionActive(msg.transcription_active);
        setTranscriptionPaused(msg.transcription_paused);
        setNameSubmitted(true);
      } else if (msg.type === "waiting_update") {
        setWaitingPatients(msg.patients || []);
      } else if (msg.type === "transcript") {
        setTranscript((prev) => [...prev, msg.text]);
      } else if (msg.type === "transcription_status") {
        setTranscriptionActive(msg.active);
        setTranscriptionPaused(msg.paused);
      }
    };
  }

  function sendControl(action) {
    wsRef.current?.send(JSON.stringify({ type: "transcription_control", action }));
  }

  function admitPatient(patientName) {
    wsRef.current?.send(JSON.stringify({ type: "admit", patient_name: patientName }));
  }

  async function handleGenerateNote() {
    setGeneratingNote(true);
    try {
      const res = await fetch(`${API}/generate-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId }),
      });
      if (!res.ok) throw new Error("Note generation failed.");
      const data = await res.json();
      setNote(data.note);
      setPhase("note");
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingNote(false);
    }
  }

  if (!nameSubmitted) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="logo-mark">✦</div>
          <h2 className="join-title">Join as Doctor</h2>
          <p className="join-sub">Room: <span className="room-code">{roomId}</span></p>
          <input
            className="name-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinSession()}
          />
          <button className="btn-primary" onClick={joinSession} disabled={!name.trim()}>
            Start Session
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return <div className="loading-screen"><div className="spinner" />Connecting…</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={liveKitUrl}
      token={token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={() => setToken(null)}
    >
      <RoomAudioRenderer />
      <div className="room-layout">
        <header className="room-header">
          <div className="header-left">
            <span className="logo-small">✦</span>
            <span className="header-title">Clinical Scribe v2</span>
            <span className="divider">|</span>
            <span className="header-room">{roomId}</span>
          </div>
          <div className="header-center">
            <SessionTimer running={transcriptionActive && !transcriptionPaused} />
            {transcriptionActive && !transcriptionPaused && (
              <div className="recording-badge"><span className="recording-dot" /> RECORDING</div>
            )}
            {transcriptionPaused && (
              <div className="paused-badge"><span>⏸</span> PAUSED</div>
            )}
          </div>
          <div className="header-right">
            {waitingPatients.length > 0 && (
              <div className="waiting-indicator">
                {waitingPatients.map((p) => (
                  <div key={p} className="waiting-patient">
                    <span>{p} is waiting</span>
                    <button className="btn-admit" onClick={() => admitPatient(p)}>Admit</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {phase === "consult" && (
          <div className="consult-layout">
            <div className="video-area">
              <VideoConference />
            </div>
            <div className="side-panel">
              <div className="control-bar">
                {!transcriptionActive && (
                  <button className="btn-control start" onClick={() => sendControl("start")}>
                    ● Start Recording
                  </button>
                )}
                {transcriptionActive && !transcriptionPaused && (
                  <button className="btn-control pause" onClick={() => sendControl("pause")}>
                    ⏸ Pause
                  </button>
                )}
                {transcriptionActive && transcriptionPaused && (
                  <button className="btn-control resume" onClick={() => sendControl("resume")}>
                    ▶ Resume
                  </button>
                )}
                {transcriptionActive && (
                  <button className="btn-control stop" onClick={() => sendControl("stop")}>
                    ■ Stop
                  </button>
                )}
              </div>
              <div className="panel panel-left">
                <div className="panel-header">
                  <span className="panel-label">LIVE TRANSCRIPT</span>
                  <span className="panel-count">{transcript.length} segments</span>
                </div>
                <div className="transcript-body" ref={transcriptRef}>
                  {transcript.length === 0 ? (
                    <p className="empty-state">
                      Press Start Recording to begin.<br />
                      <span>Transcription will appear here in real time.</span>
                    </p>
                  ) : (
                    transcript.map((line, i) => (
                      <p key={i} className="transcript-line">
                        <span className="transcript-index">{String(i + 1).padStart(2, "0")}</span>
                        {line}
                      </p>
                    ))
                  )}
                </div>
              </div>
              <button
                className="btn-generate"
                onClick={handleGenerateNote}
                disabled={generatingNote || transcript.length === 0}
              >
                {generatingNote ? "Generating note…" : "Generate Clinical Note →"}
              </button>
            </div>
          </div>
        )}

        {phase === "note" && note && (
          <div className="note-phase">
            <button className="btn-back" onClick={() => setPhase("consult")}>
              ← Back to consultation
            </button>
            <NoteEditor note={note} roomId={roomId} />
          </div>
        )}
      </div>
    </LiveKitRoom>
  );
}
