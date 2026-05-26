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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function noteToSections(note) {
  const all = [
    { id: "chief_complaint", title: "Chief Complaint", type: "text", content: note.chief_complaint || "" },
    { id: "symptoms", title: "Symptoms", type: "list", content: (note.symptoms || []).join("\n") },
    { id: "clinical_observations", title: "Clinical Observations", type: "text", content: note.clinical_observations || "" },
    { id: "diagnosis", title: "Diagnosis", type: "text", content: note.diagnosis || "" },
    {
      id: "medications", title: "Medications", type: "list",
      content: (note.medications || []).map(
        (m) => `${m.name || ""}${m.dosage ? " — " + m.dosage : ""}${m.frequency ? ", " + m.frequency : ""}${m.duration ? ", " + m.duration : ""}`
      ).join("\n"),
    },
    { id: "precautions", title: "Precautions", type: "list", content: (note.precautions || []).join("\n") },
    { id: "healthy_practices", title: "Healthy Practices", type: "list", content: (note.healthy_practices || []).join("\n") },
    { id: "follow_up", title: "Follow-Up", type: "text", content: note.follow_up || "" },
  ];
  return all.filter((s) => s.content && s.content.trim().length > 0);
}

function SortableSection({ section, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(section.content);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function saveEdit() {
    onEdit(section.id, value);
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className={`note-section ${isDragging ? "dragging" : ""}`}>
      <div className="note-section-header">
        <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">⠿</span>
        <span className="note-section-title">{section.title}</span>
        <button
          className={`btn-edit-section ${editing ? "btn-save" : ""}`}
          onClick={editing ? saveEdit : () => setEditing(true)}
        >
          {editing ? "Save" : "Edit"}
        </button>
        {editing && (
          <button className="btn-cancel-section" onClick={() => { setValue(section.content); setEditing(false); }}>
            Cancel
          </button>
        )}
      </div>
      <div className="note-section-body">
        {editing ? (
          <textarea
            className="note-textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={section.type === "list" ? Math.max(3, value.split("\n").length + 1) : 3}
            placeholder={section.type === "list" ? "One item per line" : "Enter content…"}
            autoFocus
          />
        ) : section.type === "list" ? (
          <ul className="note-list">
            {value.split("\n").filter(Boolean).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className={`note-text ${section.id === "diagnosis" ? "diagnosis" : ""} ${section.id === "follow_up" ? "followup" : ""}`}>
            {value || <span className="muted">Not recorded</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EditableNote({ note, onSectionsChange }) {
  const [sections, setSections] = useState(() => noteToSections(note));

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
        const updated = arrayMove(prev, oldIndex, newIndex);
        onSectionsChange(updated);
        return updated;
      });
    }
  }

  function handleEdit(id, newContent) {
    setSections((prev) => {
      const updated = prev.map((s) => s.id === id ? { ...s, content: newContent } : s);
      onSectionsChange(updated);
      return updated;
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="note-view">
          {sections.map((section) => (
            <SortableSection key={section.id} section={section} onEdit={handleEdit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
