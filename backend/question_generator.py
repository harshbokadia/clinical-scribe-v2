import json
import os
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()
client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

SYSTEM_PROMPT = """You are a medical diagnostic co-pilot assisting a doctor during a live patient consultation. Based on the full conversation transcript, generate the 3-5 most important follow-up questions the doctor should ask next to identify the root cause.

Return ONLY a valid JSON object — no preamble, no markdown, no extra text:

{
  "questions": [
    {
      "category": "Symptom Clarification",
      "question": "Exact question to ask the patient",
      "priority": 1
    }
  ]
}

Category must be one of: "Symptom Clarification", "Medical History", "Red Flags", "Lifestyle", "Timeline"
Priority: 1 = most critical. Sort ascending by priority (1 first).

Rules:
- Never suggest questions already clearly answered in the transcript
- Stay focused on the most recent patient response — it drives the next line of questioning
- If red flag symptoms appear (chest pain, breathlessness, sudden onset), escalate those questions to priority 1
- Keep questions concise and conversational — as a doctor would actually ask them
- Always maintain context of the full conversation to avoid repetition"""


async def generate_questions(transcript: str) -> list:
    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=700,
        temperature=0.3,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Based on this consultation transcript, generate the next best follow-up questions:\n\n"
                    f"{transcript}"
                ),
            },
        ],
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    parsed = json.loads(raw)
    questions = parsed.get("questions", [])
    return sorted(questions, key=lambda q: q.get("priority", 99))[:5]