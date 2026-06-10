import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SECTION_META = {
  chief_complaint:      { title: "Chief Complaint",      icon: "\u25ce", color: "#00C8E0" },
  symptoms:             { title: "Symptoms",              icon: "\u25c8", color: "#A78BFA" },
  clinical_observations:{ title: "Clinical Observations", icon: "\u25c9", color: "#FFB340" },
  diagnosis:            { title: "Diagnosis",             icon: "\u25c6", color: "#00C8E0" },
  medications:          { title: "Medications",           icon: "\u2295", color: "#1DD1A1" },
  precautions:          { title: "Precautions",           icon: "\u25cc", color: "#FF4757" },
  healthy_practices:    { title: "Healthy Practices",     icon: "\u25ce", color: "#1DD1A1" },
  follow_up:            { title: "Follow-Up",             icon: "\u2192", color: "#FFB340" },
};

function buildSections(note) {
  return [
    { id: "chief_complaint",       type: "text",        value: note.chief_complaint || "" },
    { id: "symptoms",              type: "list",        value: note.symptoms || [] },
    { id: "clinical_observations", type: "text",        value: note.clinical_observations || "" },
    { id: "diagnosis",             type: "text",        value: note.diagnosis || "" },
    { id: "medications",           type: "medications", value: note.medications || [] },
    { id: "precautions",           type: "list",        value: note.precautions || [] },
    { id: "healthy_practices",     type: "list",        value: note.healthy_practices || [] },
    { id: "follow_up",             type: "text",        value: note.follow_up || "" },
  ];
}

function sectionsToExport(sections) {
  return sections
    .map((s) => {
      const meta = SECTION_META[s.id] || { title: s.id };
      if (s.type === "text") {
        return { id: s.id, title: meta.title, type: "text", content: s.value || "" };
      }
      if (s.type === "list") {
        return {
          id: s.id,
          title: meta.title,
          type: "list",
          content: (s.value || []).filter(Boolean).join("\n"),
        };
      }
      if (s.type === "medications") {
        const lines = (s.value || []).map(
          (m) =>
            `${m.name || ""}${m.dosage ? " \u2014 " + m.dosage : ""}${m.frequency ? ", " + m.frequency : ""}${m.duration ? ", " + m.duration : ""}`
        );
        return { id: s.id, title: meta.title, type: "list", content: lines.join("\n") };
      }
      return null;
    })
    .filter((s) => s && s.content && s.content.trim());
}

function SortableSection({ section, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const meta = SECTION_META[section.id] || { title: section.id, icon: "\u25ce", color: "#00C8E0" };
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="ne-section">
      <div className="ne-section-head">
        <span className="ne-drag" {...attributes} {...listeners} title="Drag to reorder">
          \u22ee\u22ee
        </span>
        <span className="ne-section-icon" style={{ color: meta.color }}>{meta.icon}</span>
        <span className="ne-section-title" style={{ color: meta.color }}>{meta.title.toUpperCase()}</span>
      </div>
      <div className="ne-section-body">
        <SectionEditor section={section} meta={meta} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function SectionEditor({ section, onUpdate }) {
  if (section.type === "text") {
    return (
      <textarea
        className="ne-textarea"
        value={section.value}
        onChange={(e) => onUpdate(section.id, e.target.value)}
        rows={section.id === "clinical_observations" ? 3 : 2}
        placeholder="Not recorded — click to edit"
      />
    );
  }

  if (section.type === "list") {
    return (
      <div className="ne-list">
        {(section.value || []).map((item, i) => (
          <div key={i} className="ne-list-row">
            <input
              className="ne-list-input"
              value={item}
              onChange={(e) => {
                const u = [...section.value];
                u[i] = e.target.value;
                onUpdate(section.id, u);
              }}
              placeholder="Enter item…"
            />
            <button
              className="ne-btn-remove"
              onClick={() => onUpdate(section.id, section.value.filter((_, j) => j !== i))}
            >
              \u00d7
            </button>
          </div>
        ))}
        <button
          className="ne-btn-add"
          onClick={() => onUpdate(section.id, [...(section.value || []), ""])}
        >
          + Add item
        </button>
      </div>
    );
  }

  if (section.type === "medications") {
    return (
      <div className="ne-meds">
        {(section.value || []).map((med, i) => (
          <div key={i} className="ne-med-card">
            <div className="ne-med-row ne-med-name-row">
              <input
                className="ne-med-input ne-med-name"
                value={med.name || ""}
                placeholder="Medication name"
                onChange={(e) => {
                  const u = [...section.value];
                  u[i] = { ...u[i], name: e.target.value };
                  onUpdate(section.id, u);
                }}
              />
              <button
                className="ne-btn-remove"
                onClick={() => onUpdate(section.id, section.value.filter((_, j) => j !== i))}
              >
                \u00d7
              </button>
            </div>
            <div className="ne-med-row">
              <input className="ne-med-input" value={med.dosage || ""} placeholder="Dosage"
                onChange={(e) => { const u=[...section.value]; u[i]={...u[i],dosage:e.target.value}; onUpdate(section.id,u); }} />
              <input className="ne-med-input" value={med.frequency || ""} placeholder="Frequency"
                onChange={(e) => { const u=[...section.value]; u[i]={...u[i],frequency:e.target.value}; onUpdate(section.id,u); }} />
              <input className="ne-med-input" value={med.duration || ""} placeholder="Duration"
                onChange={(e) => { const u=[...section.value]; u[i]={...u[i],duration:e.target.value}; onUpdate(section.id,u); }} />
            </div>
          </div>
        ))}
        <button
          className="ne-btn-add"
          onClick={() => onUpdate(section.id, [...(section.value || []), { name: "", dosage: "", frequency: "", duration: "" }])}
        >
          + Add medication
        </button>
      </div>
    );
  }

  return null;
}

export default function NoteEditor({ note, roomId }) {
  const [sections, setSections] = useState(() => buildSections(note));
  const [exporting, setExporting] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      setSections((prev) => {
        const oi = prev.findIndex((s) => s.id === active.id);
        const ni = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oi, ni);
      });
    }
  }

  function updateSection(id, value) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      const exportSections = sectionsToExport(sections);
      const res = await fetch(`${API}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: exportSections }),
      });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinical_note.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="ne-root">
      <div className="ne-topbar">
        <div className="ne-topbar-left">
          <span className="ne-logo">\u2736</span>
          <span className="ne-topbar-title">Clinical Note</span>
          <span className="ne-topbar-hint">Drag to reorder \u00b7 Click to edit</span>
        </div>
        <div className="ne-topbar-right">
          <button
            className={`ne-export-btn ${exporting === "pdf" ? "ne-export-loading" : ""}`}
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
          >
            {exporting === "pdf" ? "\u2026" : "\u2193 PDF"}
          </button>
          <button
            className={`ne-export-btn ne-export-docx ${exporting === "docx" ? "ne-export-loading" : ""}`}
            onClick={() => handleExport("docx")}
            disabled={exporting !== null}
          >
            {exporting === "docx" ? "\u2026" : "\u2193 DOCX"}
          </button>
        </div>
      </div>

      <div className="ne-body">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableSection key={section.id} section={section} onUpdate={updateSection} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}