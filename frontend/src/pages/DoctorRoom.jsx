import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import VideoGrid from "../components/VideoGrid.jsx";
import ControlsBar from "../components/ControlsBar.jsx";
import SessionTimer from "../components/SessionTimer.jsx";
import NoteEditor from "../components/NoteEditor.jsx";
import SuggestionsPanel from "../components/SuggestionsPanel.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const [note, setNote] = useState(null);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [phase, setPhase] = useState("consult");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsUpdated, setSuggestionsUpdated] = useState(null);
  const suggestTimerRef = useRef(null);
  const wsRef = useRef(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    if (waitingPatients.length > 0) setShowQueue(true);
  }, [waitingPatients.length]);

  useEffect(() => {
    if (!transcriptionActive || transcript.length < 3) return;
    const totalWords = transcript.reduce((acc, t) => acc + t.text.split(" ").length, 0);
    if (totalWords < 20) return;
    clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await fetch(`${API}/suggest-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomId }),
        });
        const data = await res.json();
        setSuggestions(data.questions || []);
        setSuggestionsUpdated(new Date());
      } catch {
        // silent fail — never interrupt the doctor
      } finally {
        setSuggestionsLoading(false);
      }
    }, 2000);
    return () => clearTimeout(suggestTimerRef.current);
  }, [transcript.length, transcriptionActive]);

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
      } else if (msg.type === "patient_waiting") {
        setWaitingPatients((prev) => {
          if (prev.find((p) => p.name === msg.name)) return prev;
          return [...prev, { name: msg.name }];
        });
      } else if (msg.type === "patient_left") {
        setWaitingPatients((prev) => prev.filter((p) => p.name !== msg.name));
        setAdmittedPatients((prev) => prev.filter((p) => p.name !== msg.name));
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

  async function admitPatient(patientName) {
    await fetch(`${API}/admit-patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId, patient_name: patientName }),
    });
    setWaitingPatients((prev) => prev.filter((p) => p.name !== patientName));
    setAdmittedPatients((prev) => [...prev, { name: patientName }]);
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

  const transcriptionControls = (
    <>
      {!transcriptionActive && (
        <button className="ctrl-btn start" onClick={startTranscription}>● Start Recording</button>
      )}
      {transcriptionActive && !transcriptionPaused && (
        <button className="ctrl-btn pause" onClick={pauseTranscription}>⏸ Pause</button>
      )}
      {transcriptionActive && transcriptionPaused && (
        <button className="ctrl-btn resume" onClick={resumeTranscription}>▶ Resume</button>
      )}
      {transcriptionActive && (
        <button className="ctrl-btn stop" onClick={handleGenerateNote} disabled={generatingNote}>
          {generatingNote ? "Generating…" : "■ Stop & Generate Note"}
        </button>
      )}
    </>
  );

  return (
    <LiveKitRoom serverUrl={lkUrl} token={token} connect audio video onDisconnected={() => setToken(null)}>
      <RoomAudioRenderer />

      {showQueue && (
        <div className="queue-overlay">
          <div className="queue-panel">
            <div className="queue-header">
              <span className="queue-title">🧑 Patient Queue</span>
              <button className="queue-close" onClick={() => setShowQueue(false)}>✕</button>
            </div>
            {waitingPatients.length === 0 && admittedPatients.length === 0 ? (
              <p className="queue-empty">No patients in queue.</p>
            ) : (
              <>
                {waitingPatients.length > 0 && (
                  <div className="queue-section">
                    <p className="queue-section-label">WAITING</p>
                    {waitingPatients.map((p) => (
                      <div key={p.name} className="queue-item waiting-item">
                        <div className="queue-item-info">
                          <span className="queue-dot waiting-dot-pulse" />
                          <span className="queue-patient-name">{p.name}</span>
                        </div>
                        <button className="btn-admit" onClick={() => admitPatient(p.name)}>Admit</button>
                      </div>
                    ))}
                  </div>
                )}
                {admittedPatients.length > 0 && (
                  <div className="queue-section">
                    <p className="queue-section-label">IN SESSION</p>
                    {admittedPatients.map((p) => (
                      <div key={p.name} className="queue-item admitted-item">
                        <div className="queue-item-info">
                          <span className="queue-dot admitted-dot" />
                          <span className="queue-patient-name">{p.name}</span>
                        </div>
                        <span className="queue-status">Active</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

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
            {transcriptionPaused && <div className="paused-badge">⏸ PAUSED</div>}
          </div>
          <div className="header-right">
            <button className="btn-queue" onClick={() => setShowQueue((v) => !v)}>
              🧑 Queue
              {waitingPatients.length > 0 && (
                <span className="queue-badge">{waitingPatients.length}</span>
              )}
            </button>
          </div>
        </header>

        {phase === "consult" && (
          <div className="consult-layout">
            <div className="video-area">
              <VideoGrid />
              <ControlsBar extraControls={transcriptionControls} />
            </div>
            <div className="side-panel">
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
              {transcriptionActive && (
                <SuggestionsPanel
                  suggestions={suggestions}
                  loading={suggestionsLoading}
                  updatedAt={suggestionsUpdated}
                />
              )}
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