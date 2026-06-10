import { useTracks, VideoTrack, useParticipantInfo } from "@livekit/components-react";
import { Track } from "livekit-client";

function VideoTile({ trackRef }) {
  const { name, identity } = useParticipantInfo({ participant: trackRef.participant });
  const rawName = name || identity || "";
  const parts = rawName.split("-");
  const displayName = parts.length >= 2 ? parts.slice(1, -1).join(" ") || parts[1] : rawName;
  const isPlaceholder = !trackRef.publication;

  return (
    <div className="video-tile">
      {!isPlaceholder ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="video-avatar">
          <div className="avatar-circle">{displayName[0]?.toUpperCase() || "?"}</div>
        </div>
      )}
      <div className="video-name-tag">{displayName}</div>
    </div>
  );
}

export default function VideoGrid() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  const filtered = tracks.filter(
    (t) => !t.participant?.identity?.startsWith("agent-")
  );

  const count = Math.max(filtered.length, 1);

  return (
    <div className={`video-grid grid-${Math.min(count, 4)}`}>
      {filtered.length > 0 ? (
        filtered.map((trackRef) => (
          <VideoTile key={trackRef.participant?.identity} trackRef={trackRef} />
        ))
      ) : (
        <div className="video-tile empty-tile">
          <div className="video-placeholder">Waiting for participants…</div>
        </div>
      )}
    </div>
  );
}