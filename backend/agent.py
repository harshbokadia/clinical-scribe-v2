import asyncio
import logging
import os
import httpx
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info("Agent connected to room: %s", ctx.room.name)

    stt_instance = deepgram.STT(model="nova-2-medical", language="en-US")
    active_tasks: list[asyncio.Task] = []

    async def transcribe_track(track: rtc.RemoteAudioTrack, participant_name: str) -> None:
        audio_stream = rtc.AudioStream(track)
        stt_stream = stt_instance.stream()

        async def forward_audio() -> None:
            async for frame_event in audio_stream:
                stt_stream.push_frame(frame_event.frame)
            await stt_stream.aclose()

        async def handle_results() -> None:
            async for event in stt_stream:
                if not event.alternatives:
                    continue
                text = event.alternatives[0].text.strip()
                if not text:
                    continue
                logger.info("[%s] %s", participant_name, text)
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"{BACKEND_URL}/internal/transcript",
                            json={"room": ctx.room.name, "text": text, "speaker": participant_name},
                            timeout=5.0,
                        )
                except Exception as exc:
                    logger.warning("Failed to send transcript: %s", exc)

        await asyncio.gather(forward_audio(), handle_results())

    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if isinstance(track, rtc.RemoteAudioTrack):
            task = asyncio.ensure_future(transcribe_track(track, participant.name or participant.identity))
            active_tasks.append(task)
            task.add_done_callback(active_tasks.remove)

    ctx.room.on("track_subscribed", on_track_subscribed)

    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.subscribed and isinstance(publication.track, rtc.RemoteAudioTrack):
                task = asyncio.ensure_future(
                    transcribe_track(publication.track, participant.name or participant.identity)
                )
                active_tasks.append(task)
                task.add_done_callback(active_tasks.remove)

    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
