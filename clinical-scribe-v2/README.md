# Clinical Scribe V2

Video consultation platform with AI-powered clinical documentation. Doctor and patient join a shared video call. The doctor controls transcription — start, pause, resume, stop. On end, a structured clinical note is generated, fully editable (content + drag-to-reorder) by the doctor, and downloadable as PDF or DOCX.

---

## Features

- **Video consultation** — Doctor and patient in a shared LiveKit room with full video and audio
- **Role-based access** — Doctor and patient get separate links with distinct permissions
- **Waiting room** — Patient waits until doctor explicitly admits them
- **Session timer** — Starts when doctor begins transcription
- **Transcription controls** — Start, pause, resume, stop (doctor only)
- **Pause indicator** — Patient sees when transcription is paused
- **Editable note** — Every section editable; drag-to-reorder sections (doctor only)
- **PDF + DOCX export** — Downloads the doctor's edited version

---

## Setup

### Step 1 — Configure environment
```bash
cd backend
cp .env.example .env
# Fill in all values
```

### Step 2 — Install backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
```

### Step 3 — Install frontend
```bash
cd frontend
npm install
```

Create `frontend/.env` with:
```
VITE_API_URL=http://localhost:8000
```

---

## Launch (3 terminals)

**Terminal 1 — API server:**
```bash
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000
```
Wait for: `Application startup complete.`

**Terminal 2 — Agent worker:**
```bash
cd backend && source venv/bin/activate
python agent.py start
```
Wait for: `registered worker`

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**

---

## Usage

1. Open the app → click **Create Consultation Session**
2. Share the **Doctor Link** with yourself and the **Patient Link** with the patient
3. Both enter their names and join
4. Patient lands in the waiting room — doctor clicks **Admit**
5. Doctor clicks **Start Transcription** to begin
6. Use **Pause / Resume** as needed during the consultation
7. Click **End & Generate Note** — structured note appears on the right
8. Edit any section, reorder by dragging, then download as **PDF** or **DOCX**
