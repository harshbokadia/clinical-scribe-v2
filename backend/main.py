import os
import uuid
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
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

room_transcripts: Dict[str, List[dict]] = {}
room_connections: Dict[str, List[WebSocket]] = {}
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
async def admit_patient(req: RoomRequest):
    await _broadcast(req.room, {"type": "patient_admitted"})
    return {"status": "admitted"}


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in room_connections:
        room_connections[room_id] = []
    room_connections[room_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if room_id in room_connections:
            try:
                room_connections[room_id].remove(websocket)
            except ValueError:
                pass


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
