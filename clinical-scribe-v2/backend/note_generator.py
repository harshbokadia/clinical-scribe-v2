import json
import os
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

SYSTEM_PROMPT = """You are a clinical documentation specialist. Given a verbatim transcription of a doctor-patient consultation, extract and structure all medically relevant information into a formal clinical note.

Return ONLY a valid JSON object with exactly these keys — no preamble, no markdown fences, no extra text:

{
  "chief_complaint": "One-sentence summary of why the patient visited",
  "symptoms": ["Each symptom as a concise string"],
  "clinical_observations": "Doctor's physical or diagnostic observations as a single paragraph",
  "diagnosis": "Primary diagnosis stated by the doctor",
  "medications": [
    {
      "name": "Medication name",
      "dosage": "Dose amount and unit",
      "frequency": "How often (e.g., twice daily)",
      "duration": "For how long (e.g., 5 days)"
    }
  ],
  "precautions": ["Each precaution as a concise string"],
  "healthy_practices": ["Each lifestyle or dietary recommendation as a concise string"],
  "follow_up": "Follow-up instruction, or null if none mentioned"
}

Rules:
- Never invent or infer dosages not explicitly stated. Use null for unknown fields.
- If a section has no information, use an empty array [] or null.
- Be concise and clinical. Avoid redundancy.
- Medications array must be empty [] if none were prescribed."""


async def generate_note(transcript: str) -> dict:
    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Generate a structured clinical note from the following "
                    f"consultation transcript:\n\n{transcript}"
                ),
            },
        ],
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    return json.loads(raw)
