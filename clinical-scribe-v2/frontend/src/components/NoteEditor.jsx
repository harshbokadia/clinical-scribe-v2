import { useState, useCallback } from "react";
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

function buildSections(note) {
  return [
    { id: "chief_complaint", title: "CHIEF COMPLAINT", icon: "◎", type: "text", value: note.chief_complaint || "" },
    { id: "symptoms", title: "SYMPTOMS", icon: "◈", type: "list", value: note.symptoms || [] },
    { id: "clinical_observations", title: "CLINICAL OBSERVATIONS", icon: "◉", type: "text", value: note.clinical_observations || "" },
    { id: "diagnosis", title: "DIAGNOSIS", icon: "◆", type: "text", value: note.diagnosis || "" },
    { id: "medications", title: "MEDICATIONS", icon: "⊕", type: "medications", value: note.medications || [] },
    { id: "precautions", title: "PRECAUTIONS", icon: "◌", type: "list", value: note.precautions || [] },
    { id: "healthy_practices", title: "HEALTHY PRACTICES", icon: "◎", type: "list", value: note.healthy_practices || [] },
    { id: "follow_up", title: "FOLLOW-UP", icon: "→", type: "text", value: note.follow_up || "" },
  ];
}

function sectionsToNote(sections) {
  const note = {};
  sections.forEach((s) => { note[s.id] = s.value; });
  return note;
}

function SortableSection({ section, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`note-section-edit${isDragging ? " dragging" : ""}`}>
      <div className="note-section-header-edit">
        <div className="drag-handle" {...attributes} {...listeners}>⠿</div>
        <span className="note-icon">{section.icon}</span>
        <span className="note-section-title">{section.title}</span>
      </div>
      <div className="note-section-body-edit">
        <SectionEditor section={section} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function SectionEditor({ section, onUpdate }) {
  if (section.type === "text") {
    return (
      <textarea
        className="note-textarea"
        value={section.value}
        onChange={(e) => onUpdate(section.id, e.target.value)}
        rows={section.id === "clinical_observations" ? 3 : 2}
        placeholder={`Enter ${section.title.toLowerCase()}…`}
      />
    );
  }

  if (section.type === "list") {
    return (
      <div className="note-list-editor">
        {section.value.map((item, i) => (
          <div key={i} className="note-list-row">
            <input
              className="note-list-input"
              value={item}
              onChange={(e) => {
                const updated = [...section.value];
                updated[i] = e.target.value;
                onUpdate(section.id, updated);
              }}
              placeholder="Enter item…"
            />
            <button
              className="btn-remove"
              onClick={() => {
                const updated = section.value.filter((_, idx) => idx !== i);
                onUpdate(section.id, updated);
              }}
            >×</button>
          </div>
        ))}
        <button
          className="btn-add-item"
          onClick={() => onUpdate(section.id, [...section.value, ""])}
        >+ Add item</button>
      </div>
    );
  }

  if (section.type === "medications") {
    return (
      <div className="note-med-editor">
        {section.value.map((med, i) => (
          <div key={i} className="med-edit-card">
            <div className="med-edit-row">
              <input className="med-input med-name" value={med.name || ""} placeholder="Medication name"
                onChange={(e) => {
                  const updated = [...section.value];
                  updated[i] = { ...updated[i], name: e.target.value };
                  onUpdate(section.id, updated);
                }} />
              <button className="btn-remove" onClick={() => {
                onUpdate(section.id, section.value.filter((_, idx) => idx !== i));
              }}>×</button>
            </div>
            <div className="med-edit-row">
              <input className="med-input" value={med.dosage || ""} placeholder="Dosage"
                onChange={(e) => {
                  const updated = [...section.value];
                  updated[i] = { ...updated[i], dosage: e.target.value };
                  onUpdate(section.id, updated);
                }} />
              <input className="med-input" value={med.frequency || ""} placeholder="Frequency"
                onChange={(e) => {
                  const updated = [...section.value];
                  updated[i] = { ...updated[i], frequency: e.target.value };
                  onUpdate(section.id, updated);
                }} />
              <input className="med-input" value={med.duration || ""} placeholder="Duration"
                onChange={(e) => {
                  const updated = [...section.value];
                  updated[i] = { ...updated[i], duration: e.target.value };
                  onUpdate(section.id, updated);
                }} />
            </div>
          </div>
        ))}
        <button className="btn-add-item" onClick={() => {
          onUpdate(section.id, [...section.value, { name: "", dosage: "", frequency: "", duration: "" }]);
        }}>+ Add medication</button>
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

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSections((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function updateSection(id, value) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, value } : s));
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      const res = await fetch(`${API}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, note: sectionsToNote(sections) }),
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
    <div className="note-editor">
      <div className="note-editor-header">
        <div className="note-editor-title">
          <span className="note-icon">✦</span>
          CLINICAL NOTE
        </div>
        <p className="note-editor-hint">Drag sections to reorder · Click any field to edit</p>
        <div className="export-buttons">
          <button className="btn-export" onClick={() => handleExport("pdf")} disabled={exporting !== null}>
            {exporting === "pdf" ? "Exporting…" : "↓ PDF"}
          </button>
          <button className="btn-export" onClick={() => handleExport("docx")} disabled={exporting !== null}>
            {exporting === "docx" ? "Exporting…" : "↓ DOCX"}
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="note-sections-list">
            {sections.map((section) => (
              <SortableSection key={section.id} section={section} onUpdate={updateSection} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
