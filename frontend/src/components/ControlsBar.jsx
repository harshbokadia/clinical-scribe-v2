import { useLocalParticipant } from "@livekit/components-react";

export default function ControlsBar({ extraControls }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  function toggleMic() {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  function toggleCamera() {
    localParticipant.setCameraEnabled(!isCameraEnabled);
  }

  async function toggleScreenShare() {
    await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
  }

  return (
    <div className="controls-bar">
      <button
        className={`ctrl-btn ${!isMicrophoneEnabled ? "ctrl-off" : ""}`}
        onClick={toggleMic}
        title={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isMicrophoneEnabled ? "🎙 Mute" : "🔇 Unmute"}
      </button>
      <button
        className={`ctrl-btn ${!isCameraEnabled ? "ctrl-off" : ""}`}
        onClick={toggleCamera}
        title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isCameraEnabled ? "📹 Camera Off" : "📷 Camera On"}
      </button>
      <button
        className={`ctrl-btn ${isScreenShareEnabled ? "ctrl-active" : ""}`}
        onClick={toggleScreenShare}
        title={isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
      >
        🖥 {isScreenShareEnabled ? "Stop Share" : "Share Screen"}
      </button>
      {extraControls && <div className="ctrl-sep" />}
      {extraControls}
    </div>
  );
}