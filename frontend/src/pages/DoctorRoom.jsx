import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRemoteParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import SessionTimer from "../components/SessionTimer.jsx";
import NoteEditor from "../components/NoteEditor.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function PatientWatcher({ onPatientJoin }) {
  const remoteParticipants = useRemoteParticipants();
  const seenRef = useRef(new Set());

  useEffect(() => {
    remoteParticipants.forEach((p) => {
      if (p.identity.startsWith("patient-") && !seenRef.current.has(p.identity)) {
        seenRef.current.add(p.identity);
        onPatientJoin({ identity: p.identity, name: p.name });
      }
    });
  }, [remoteParticipants]);

  return null;
}

export default function DoctorRoom() {
  const { roomId } = useParams();
  const [name, setName] = useState("");
  const [token, setToken] = useState(null);
  const [lkUrl, setLkUrl] = useState(null);
  const [joining, setJoining] = useState(false);
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

  async function joinSession() {
    if (!name.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`${API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, role: "doctor", name: name.trim() }),
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
      if (msg.type === "transcript") {
        setTranscript((prev) => [...prev, { text: msg.text, speaker: msg.speaker }]);
      } else if (msg.type === "transcription_state") {
        setTranscriptionPaused(msg.state === "paused");
      }
    };
  }

  async function startTranscription() {
    await fetch(`${API}/transcription/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionActive(true);
    setTranscriptionPaused(false);
  }

  async function pauseTranscription() {
    await fetch(`${API}/transcription/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionPaused(true);
  }

  async function resumeTranscription() {
    await fetch(`${API}/transcription/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionPaused(false);
  }

  async function admitPatient(identity) {
    await fetch(`${API}/admit-patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setWaitingPatients((prev) => prev.filter((p) => p.identity !== identity));
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

  if (!token) {
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
            autoFocus
          />
          <button className="btn-primary" onClick={joinSession} disabled={!name.trim() || joining}>
            {joining ? "Connecting…" : "Start Session"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={lkUrl} token={token} connect audio video onDisconnected={() => setToken(null)}>
      <RoomAudioRenderer />
      <PatientWatcher onPatientJoin={(p) => setWaitingPatients((prev) => [...prev, p])} />
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
              <div className="paused-badge">⏸ PAUSED</div>
            )}
          </div>
          <div className="header-right">
            {waitingPatients.length > 0 && waitingPatients.map((p) => (
              <div key={p.identity} className="waiting-patient">
                <span>🧑 {p.name || p.identity} is waiting</span>
                <button className="btn-admit" onClick={() => admitPatient(p.identity)}>Admit</button>
              </div>
            ))}
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
                  <button className="btn-control start" onClick={startTranscription}>
                    ● Start Recording
                  </button>
                )}
                {transcriptionActive && !transcriptionPaused && (
                  <button className="btn-control pause" onClick={pauseTranscription}>
                    ⏸ Pause
                  </button>
                )}
                {transcriptionActive && transcriptionPaused && (
                  <button className="btn-control resume" onClick={resumeTranscription}>
                    ▶ Resume
                  </button>
                )}
                {transcriptionActive && (
                  <button className="btn-control stop" onClick={handleGenerateNote} disabled={generatingNote}>
                    {generatingNote ? "Generating…" : "■ Stop & Generate Note"}
                  </button>
                )}
              </div>
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
                      {line.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {phase === "note" && note && (
          <div className="note-phase">
            <button className="btn-back" onClick={() => setPhase("consult")}>← Back to consultation</button>
            <NoteEditor note={note} roomId={roomId} />
          </div>
        )}
      </div>
    </LiveKitRoom>
  );
}