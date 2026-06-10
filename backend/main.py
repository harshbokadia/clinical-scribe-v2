import os
import uuid
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from livekit import api as livekit_api
from note_generator import generate_note
from document_export import export_pdf, export_docx
from question_generator import generate_questions as generate_diagnostic_questions
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

room_transcripts: Dict[str, List[dict]] = {}
room_connections: Dict[str, List[WebSocket]] = {}
patient_connections: Dict[str, Dict[str, WebSocket]] = {}
transcription_states: Dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Clinical Scribe V2", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TokenRequest(BaseModel):
    room_id: str
    role: str
    name: str


class TranscriptChunk(BaseModel):
    room: str
    text: str
    speaker: Optional[str] = None


class RoomRequest(BaseModel):
    room: str


class AdmitRequest(BaseModel):
    room: str
    patient_name: str


class ExportRequest(BaseModel):
    sections: list


@app.post("/create-room")
async def create_room():
    room_id = str(uuid.uuid4())[:8].upper()
    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return {
        "room_id": room_id,
        "doctor_url": f"{base_url}/doctor/{room_id}",
        "patient_url": f"{base_url}/patient/{room_id}",
    }


@app.post("/token")
async def get_token(req: TokenRequest):
    is_doctor = req.role == "doctor"
    grants = livekit_api.VideoGrants(
        room_join=True,
        room=req.room_id,
        can_publish=True,
        can_subscribe=True,
        room_admin=is_doctor,
    )
    token = (
        livekit_api.AccessToken(
            os.environ["LIVEKIT_API_KEY"],
            os.environ["LIVEKIT_API_SECRET"],
        )
        .with_identity(f"{req.role}-{req.name}-{uuid.uuid4().hex[:4]}")
        .with_name(req.name)
        .with_grants(grants)
        .to_jwt()
    )
    return {"token": token, "url": os.environ["LIVEKIT_URL"]}


@app.post("/internal/transcript")
async def receive_transcript(chunk: TranscriptChunk):
    state = transcription_states.get(chunk.room, "active")
    if state == "paused":
        return {"status": "paused"}
    if chunk.room not in room_transcripts:
        room_transcripts[chunk.room] = []
    room_transcripts[chunk.room].append({"text": chunk.text, "speaker": chunk.speaker or "unknown"})
    await _broadcast(chunk.room, {"type": "transcript", "text": chunk.text, "speaker": chunk.speaker})
    return {"status": "ok"}


@app.post("/transcription/pause")
async def pause_transcription(req: RoomRequest):
    transcription_states[req.room] = "paused"
    await _broadcast(req.room, {"type": "transcription_state", "state": "paused"})
    return {"status": "paused"}


@app.post("/transcription/resume")
async def resume_transcription(req: RoomRequest):
    transcription_states[req.room] = "active"
    await _broadcast(req.room, {"type": "transcription_state", "state": "active"})
    return {"status": "active"}


@app.post("/admit-patient")
async def admit_patient(req: AdmitRequest):
    ws = patient_connections.get(req.room, {}).get(req.patient_name)
    if ws:
        try:
            await ws.send_json({"type": "patient_admitted"})
        except Exception as e:
            logger.warning("Failed to notify patient: %s", e)
    return {"status": "admitted"}


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in room_connections:
        room_connections[room_id] = []
    room_connections[room_id].append(websocket)

    patient_name = None

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            if msg.get("type") == "patient_waiting":
                patient_name = msg.get("name", "Unknown")
                if room_id not in patient_connections:
                    patient_connections[room_id] = {}
                patient_connections[room_id][patient_name] = websocket
                await _broadcast_except(room_id, {
                    "type": "patient_waiting",
                    "name": patient_name,
                }, exclude=websocket)
                logger.info("Patient '%s' joined waiting room in room %s", patient_name, room_id)

    except WebSocketDisconnect:
        if room_id in room_connections:
            try:
                room_connections[room_id].remove(websocket)
            except ValueError:
                pass
        if patient_name and room_id in patient_connections:
            patient_connections[room_id].pop(patient_name, None)
            await _broadcast(room_id, {"type": "patient_left", "name": patient_name})


@app.post("/generate-note")
async def generate_doctor_note(req: RoomRequest):
    transcript = room_transcripts.get(req.room, [])
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found.")
    full_text = " ".join([t["text"] for t in transcript])
    note = await generate_note(full_text)
    return {"note": note}


@app.post("/export/pdf")
async def export_note_pdf(req: ExportRequest):
    path = export_pdf(req.sections)
    return FileResponse(path, filename="clinical_note.pdf", media_type="application/pdf")


@app.post("/export/docx")
async def export_note_docx(req: ExportRequest):
    path = export_docx(req.sections)
    return FileResponse(
        path,
        filename="clinical_note.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )



@app.post("/suggest-questions")
async def suggest_questions(req: RoomRequest):
    transcript = room_transcripts.get(req.room, [])
    if len(transcript) < 3:
        return {"questions": []}
    total_words = sum(len(t["text"].split()) for t in transcript)
    if total_words < 20:
        return {"questions": []}
    full_text = " ".join([t["text"] for t in transcript])
    questions = await generate_diagnostic_questions(full_text)
    return {"questions": questions}


async def _broadcast(room_id: str, message: dict):
    connections = room_connections.get(room_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


async def _broadcast_except(room_id: str, message: dict, exclude: WebSocket):
    connections = room_connections.get(room_id, [])
    dead = []
    for ws in connections:
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)