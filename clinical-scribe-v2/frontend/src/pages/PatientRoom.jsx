import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  RoomAudioRenderer,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function PatientRoom() {
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
      body: JSON.stringify({ room_id: roomId, role: "patient", name: name.trim() }),
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
          <div className="logo-mark">🧑</div>
          <h1 className="home-title">Join Consultation</h1>
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
            Join Consultation
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={lkUrl} token={token} connect audio video onDisconnected={() => setToken(null)}>
      <RoomAudioRenderer />
      <PatientInterface roomId={roomId} patientName={name} />
    </LiveKitRoom>
  );
}

function PatientInterface({ roomId, patientName }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], { onlySubscribed: false });

  const [admitted, setAdmitted] = useState(false);
  const [transcriptionPaused, setTranscriptionPaused] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/ws/${roomId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "patient_admitted") setAdmitted(true);
      if (msg.type === "transcription_state") setTranscriptionPaused(msg.state === "paused");
    };
    return () => ws.close();
  }, [roomId]);

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

  if (!admitted) {
    return (
      <div className="waiting-room">
        <div className="waiting-card">
          <div className="waiting-spinner" />
          <h2>Waiting Room</h2>
          <p>Please wait while the doctor admits you to the consultation.</p>
          <div className="waiting-name">Joining as: <strong>{patientName}</strong></div>
          <div className="waiting-room-id">Session: {roomId}</div>
        </div>
      </div>
    );
  }

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
          {transcriptionPaused && (
            <div className="pause-badge">⏸ TRANSCRIPTION PAUSED</div>
          )}
        </div>
        <div className="header-right">
          <span className="patient-badge">🧑 {patientName}</span>
        </div>
      </header>

      <div className="room-body patient-body">
        <div className="video-area full-width">
          <div className="video-grid">
            <div className="video-tile self-tile">
              {localVideoTrack ? (
                <VideoTrack trackRef={localVideoTrack} />
              ) : (
                <div className="video-placeholder">📷 Camera off</div>
              )}
              <div className="video-name-tag">You ({patientName})</div>
            </div>
            {remoteVideoTracks.length > 0 ? (
              remoteVideoTracks.map((t) => (
                <div key={t.publication?.trackSid} className="video-tile">
                  <VideoTrack trackRef={t} />
                  <div className="video-name-tag">{t.participant?.name || "Doctor"}</div>
                </div>
              ))
            ) : (
              <div className="video-tile empty-tile">
                <div className="video-placeholder">Waiting for doctor's video…</div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
