import { useState, useEffect, useRef } from "react";

export default function SessionTimer({ running }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="session-timer">
      {h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`}
    </div>
  );
}
