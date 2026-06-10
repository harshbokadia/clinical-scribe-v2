import { useState } from "react";

const CATEGORY_STYLES = {
  "Symptom Clarification": { color: "#00C8E0", bg: "rgba(0,200,224,0.08)", border: "rgba(0,200,224,0.25)" },
  "Medical History":       { color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  "Red Flags":             { color: "#FF4757", bg: "rgba(255,71,87,0.08)", border: "rgba(255,71,87,0.25)" },
  "Lifestyle":             { color: "#1DD1A1", bg: "rgba(29,209,161,0.08)", border: "rgba(29,209,161,0.25)" },
  "Timeline":              { color: "#FFB340", bg: "rgba(255,179,64,0.08)", border: "rgba(255,179,64,0.25)" },
};

function timeAgo(date) {
  if (!date) return null;
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function SuggestionsPanel({ suggestions, loading, updatedAt }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="suggestions-panel">
      <div className="suggestions-header" onClick={() => setCollapsed((v) => !v)}>
        <div className="suggestions-header-left">
          <span className="suggestions-icon">\u2695</span>
          <span className="suggestions-title">Diagnostic Assist</span>
          {loading && <span className="suggestions-spinner" />}
        </div>
        <div className="suggestions-header-right">
          {updatedAt && !loading && (
            <span className="suggestions-updated">{timeAgo(updatedAt)}</span>
          )}
          <span className="suggestions-chevron">{collapsed ? "\u25b2" : "\u25bc"}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="suggestions-body">
          {suggestions.length === 0 && !loading && (
            <p className="suggestions-empty">
              Suggestions will appear as the conversation develops.
            </p>
          )}
          {suggestions.map((q, i) => {
            const style = CATEGORY_STYLES[q.category] || CATEGORY_STYLES["Symptom Clarification"];
            return (
              <div
                key={i}
                className="suggestion-item"
                style={{ background: style.bg, borderColor: style.border }}
              >
                <div className="suggestion-meta">
                  <span className="suggestion-priority">{i + 1}</span>
                  <span className="suggestion-category" style={{ color: style.color }}>
                    {q.category}
                  </span>
                </div>
                <p className="suggestion-question">{q.question}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}