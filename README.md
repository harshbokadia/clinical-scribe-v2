# Clinical Scribe v2

A full-stack video consultation platform with AI-powered clinical documentation. Doctor and patient join a private video room. The doctor controls transcription (start, pause, resume, stop). When the consultation ends, the doctor generates a structured clinical note, edits it inline, reorders sections via drag-and-drop, and downloads it as PDF or DOCX.

---

## What's new in v2

- **Video consultation** — LiveKit-powered video rooms for doctor and patient
- **Separate role links** — Doctor gets one link, patient gets another
- **Waiting room** — Patient waits until doctor admits them
- **Transcription controls** — Doctor controls start, pause, resume, stop (patient sees status)
- **Editable note** — Every section is editable after generation
- **Drag-to-reorder** — Doctor can reorder note sections via drag-and-drop
- **Session timer** — Tracks active recording time

---

## Architecture

```
Doctor Browser ──────────────────────────────────────────┐
                    LiveKit Room (video + audio)           │
Patient Browser ─────────────────────────────────────────┘
                           ↓
                  Observant Agent (agent.py)
                           ↓
               Deepgram STT (nova-2-medical)
                           ↓
               FastAPI /internal/transcript
                           ↓
              WebSocket → Browsers (live transcript)
                           ↓
                [Doctor clicks Generate Note]
                           ↓
                Groq · LLaMA 3.3 70B
                           ↓
         Editable Note Editor → PDF / DOCX
```

---

## Project Structure

```
clinical-scribe-v2/
├── backend/
│   ├── main.py             # FastAPI — rooms, waiting room, WebSocket, transcription controls
│   ├── agent.py            # LiveKit observant agent
│   ├── note_generator.py   # Groq note generation
│   ├── document_export.py  # PDF + DOCX export
│   ├── start.sh            # Combined startup for deployment
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx               # React Router setup
    │   ├── pages/
    │   │   ├── CreateRoom.jsx    # Session creation + link sharing
    │   │   ├── DoctorRoom.jsx    # Full doctor interface
    │   │   └── PatientRoom.jsx   # Patient interface + waiting room
    │   └── components/
    │       ├── NoteEditor.jsx    # Drag-and-drop editable note
    │       └── SessionTimer.jsx  # Session timer
    └── .env.example
```

---

## Setup

### Step 1 — API keys

| Key | Source |
|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | cloud.livekit.io → Settings → Keys |
| `GROQ_API_KEY` | console.groq.com |
| `DEEPGRAM_API_KEY` | console.deepgram.com |

### Step 2 — Backend

```bash
cd backend
cp .env.example .env   # fill in your keys
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install websockets
```

### Step 3 — Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL if needed
npm install
```

---

## Launch (3 terminals)

**Terminal 1 — API server:**
```bash
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Agent worker:**
```bash
cd backend && source venv/bin/activate
python agent.py start
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**

---

## Usage

1. Open the app → click **Create Consultation Session**
2. Share the **Doctor link** with yourself and the **Patient link** with the patient
3. Doctor opens their link, enters name → **Start Session**
4. Patient opens their link, enters name → enters waiting room
5. Doctor sees patient in the header → clicks **Admit**
6. Both are now in the video call
7. Doctor clicks **● Start Recording** to begin transcription
8. Use **⏸ Pause** / **▶ Resume** / **■ Stop** as needed
9. Click **Generate Clinical Note →** when ready
10. Edit sections inline, drag to reorder
11. Download as **PDF** or **DOCX**
