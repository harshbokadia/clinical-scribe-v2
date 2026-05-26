import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  RoomAudioRenderer,
  VideoTrack,
  AudioTrack,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import SessionTimer from "../components/SessionTimer.jsx";
import EditableNote from "../components/EditableNote.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function DoctorRoom() {
  const { roomId } = useParams();
  const [name, setName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [token, setToken] = useState(null);
  const [lkUrl, setLkUrl] = useState(null);

  async function joinRoom() {
    if (!name.trim()) return;
    const res = await fetch(`${API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, role: "doctor", name: name.trim() }),
    });
    const data = await res.json();
    setLkUrl(data.url);
    setToken(data.token);
    setNameSubmitted(true);
  }

  if (!nameSubmitted) {
    return (
      <div className="home">
        <div className="home-card">
          <div className="logo-mark">👨‍⚕️</div>
          <h1 className="home-title">Doctor — Join Session</h1>
          <p className="home-sub">Session ID: <strong>{roomId}</strong></p>
          <input
            className="name-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            autoFocus
          />
          <button className="btn-primary" onClick={joinRoom} disabled={!name.trim()}>
            Join as Doctor
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={lkUrl} token={token} connect audio video onDisconnected={() => setToken(null)}>
      <RoomAudioRenderer />
      <DoctorInterface roomId={roomId} doctorName={name} />
    </LiveKitRoom>
  );
}

function DoctorInterface({ roomId, doctorName }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], { onlySubscribed: false });

  const [transcript, setTranscript] = useState([]);
  const [note, setNote] = useState(null);
  const [editedSections, setEditedSections] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [transcriptionState, setTranscriptionState] = useState("stopped");
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(null);
  const transcriptRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/ws/${roomId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "transcript") {
        setTranscript((prev) => [...prev, { text: msg.text, speaker: msg.speaker }]);
      } else if (msg.type === "patient_waiting") {
        setWaitingPatients((prev) => [...prev, msg]);
      }
    };
    return () => ws.close();
  }, [roomId]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    const newPatients = remoteParticipants.filter(
      (p) => p.identity.startsWith("patient-")
    );
    setWaitingPatients((prev) => {
      const existingIds = prev.map((w) => w.identity);
      const toAdd = newPatients.filter(
        (p) => !existingIds.includes(p.identity)
      ).map((p) => ({ identity: p.identity, name: p.name }));
      return [...prev, ...toAdd];
    });
  }, [remoteParticipants]);

  async function admitPatient(identity) {
    await fetch(`${API}/admit-patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setWaitingPatients((prev) => prev.filter((p) => p.identity !== identity));
  }

  async function startTranscription() {
    setTranscriptionState("active");
    setPhase("recording");
  }

  async function pauseTranscription() {
    await fetch(`${API}/transcription/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionState("paused");
  }

  async function resumeTranscription() {
    await fetch(`${API}/transcription/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionState("active");
  }

  async function endConsultation() {
    await fetch(`${API}/transcription/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId }),
    });
    setTranscriptionState("stopped");
    setPhase("generating");
    setGenerating(true);
    try {
      const res = await fetch(`${API}/generate-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId }),
      });
      const data = await res.json();
      setNote(data.note);
      setPhase("done");
    } catch {
      alert("Note generation failed.");
      setPhase("recording");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadFile(format) {
    setExporting(format);
    try {
      const res = await fetch(`${API}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: editedSections }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinical_note.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    } finally {
      setExporting(null);
    }
  }

  function toggleAudio() {
    localParticipant.setMicrophoneEnabled(audioMuted);
    setAudioMuted(!audioMuted);
  }

  function toggleVideo() {
    localParticipant.setCameraEnabled(videoMuted);
    setVideoMuted(!videoMuted);
  }

  const localVideoTrack = tracks.find(
    (t) => t.participant?.isLocal && t.source === Track.Source.Camera
  );
  const remoteVideoTracks = tracks.filter(
    (t) => !t.participant?.isLocal && t.source === Track.Source.Camera
  );

  return (
    <div className="room-layout">
      <header className="room-header">
        <div className="header-left">
          <span className="logo-small">✦</span>
          <span className="header-title">Clinical Scribe</span>
          <span className="header-sep">|</span>
          <span className="header-room">{roomId}</span>
        </div>
        <div className="header-center">
          <SessionTimer running={phase === "recording"} />
          {transcriptionState === "paused" && (
            <div className="pause-badge">⏸ TRANSCRIPTION PAUSED</div>
          )}
        </div>
        <div className="header-right">
          {phase === "done" && (
            <div className="export-buttons">
              <button className="btn-export" onClick={() => downloadFile("pdf")} disabled={exporting !== null}>
                {exporting === "pdf" ? "Exporting…" : "↓ PDF"}
              </button>
              <button className="btn-export" onClick={() => downloadFile("docx")} disabled={exporting !== null}>
                {exporting === "docx" ? "Exporting…" : "↓ DOCX"}
              </button>
            </div>
          )}
        </div>
      </header>

      {waitingPatients.length > 0 && (
        <div className="waiting-banner">
          {waitingPatients.map((p) => (
            <div key={p.identity} className="waiting-item">
              <span>🧑 <strong>{p.name || p.identity}</strong> is waiting to join</span>
              <button className="btn-admit" onClick={() => admitPatient(p.identity)}>
                Admit
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="room-body">
        <div className="video-area">
          <div className="video-grid">
            <div className="video-tile self-tile">
              {localVideoTrack ? (
                <VideoTrack trackRef={localVideoTrack} />
              ) : (
                <div className="video-placeholder">📷 Camera off</div>
              )}
              <div className="video-name-tag">You ({doctorName})</div>
            </div>
            {remoteVideoTracks.length > 0 ? (
              remoteVideoTracks.map((t) => (
                <div key={t.publication?.trackSid} className="video-tile">
                  <VideoTrack trackRef={t} />
                  <div className="video-name-tag">{t.participant?.name || "Patient"}</div>
                </div>
              ))
            ) : (
              <div className="video-tile empty-tile">
                <div className="video-placeholder">Waiting for patient…</div>
              </div>
            )}
          </div>

          <div className="controls-bar">
            <button className={`ctrl-btn ${audioMuted ? "ctrl-off" : ""}`} onClick={toggleAudio}>
              {audioMuted ? "🔇 Unmute" : "🎙 Mute"}
            </button>
            <button className={`ctrl-btn ${videoMuted ? "ctrl-off" : ""}`} onClick={toggleVideo}>
              {videoMuted ? "📷 Start Video" : "📹 Stop Video"}
            </button>
            <div className="ctrl-sep" />
            {phase === "idle" && (
              <button className="ctrl-btn ctrl-start" onClick={startTranscription}>
                ⏺ Start Transcription
              </button>
            )}
            {phase === "recording" && transcriptionState === "active" && (
              <button className="ctrl-btn ctrl-pause" onClick={pauseTranscription}>
                ⏸ Pause
              </button>
            )}
            {phase === "recording" && transcriptionState === "paused" && (
              <button className="ctrl-btn ctrl-resume" onClick={resumeTranscription}>
                ▶ Resume
              </button>
            )}
            {phase === "recording" && (
              <button className="ctrl-btn ctrl-end" onClick={endConsultation}>
                ⏹ End & Generate Note
              </button>
            )}
          </div>
        </div>

        <div className="side-panel">
          <div className="panel-tabs">
            <span className="panel-tab active">
              {phase === "done" ? "CLINICAL NOTE" : "LIVE TRANSCRIPT"}
            </span>
            {phase === "recording" && (
              <span className="transcript-count">{transcript.length} segments</span>
            )}
          </div>

          {phase === "idle" && (
            <div className="side-empty">
              <p>Start transcription to see the live transcript here.</p>
            </div>
          )}

          {phase === "recording" && (
            <div className="transcript-body" ref={transcriptRef}>
              {transcript.length === 0 ? (
                <p className="side-empty-text">Listening for speech…</p>
              ) : (
                transcript.map((line, i) => (
                  <p key={i} className="transcript-line">
                    <span className="transcript-speaker">{line.speaker?.split("-")[1] || "?"}</span>
                    {line.text}
                  </p>
                ))
              )}
            </div>
          )}

          {phase === "generating" && (
            <div className="generating-state">
              <div className="pulse-ring" />
              <p>Analysing transcript…</p>
            </div>
          )}

          {phase === "done" && note && (
            <div className="note-body">
              <p className="note-hint">
                ⠿ Drag sections to reorder &nbsp;·&nbsp; Click <strong>Edit</strong> to modify content
              </p>
              <EditableNote
                note={note}
                onSectionsChange={(sections) => setEditedSections(sections)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
