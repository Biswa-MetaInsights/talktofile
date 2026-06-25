"""
Flashcard Agent — generates Q&A flashcards from document content.
Returns a list of {question, answer, hint} dicts.
"""

import json
from openai import AsyncOpenAI
from core.session_store import DocumentData
from core.config import get_settings
from agents.lingua_agent import translate_to_english


_PROMPT = """You are a flashcard generator. Given document content, create a set of Q&A flashcards
that help someone learn and test their understanding of the material.

Rules:
- Generate between 10 and 20 flashcards depending on the document length.
- Questions should test key facts, concepts, definitions, and relationships from the document.
- Answers should be concise (1-3 sentences) and drawn ONLY from the document.
- Difficulty: mix easy (recall), medium (understanding), and hard (application/analysis).
- Include a short hint (a clue, not the answer).

Return ONLY a JSON array with this structure (no markdown, no extra text):
[
  {"question": "...", "answer": "...", "hint": "...", "difficulty": "easy|medium|hard"},
  ...
]"""


async def _build_context(documents: list[DocumentData]) -> str:
    parts = []
    for doc in documents:
        if isinstance(doc.summary, dict):
            s = doc.summary
            overview = s.get("overview", "")
            kps = "; ".join(s.get("key_points", []))
            parts.append(f"=== {doc.filename} — Overview ===\n{overview}\nKey points: {kps}")
        if doc.chunks:
            content = "\n\n".join(doc.chunks)[:6000]
            lang = getattr(doc, "original_language", "en") or "en"
            if not (lang == "en" or lang.startswith("en")):
                content = await translate_to_english(content, lang)
            parts.append(f"=== {doc.filename} — Content ===\n{content}")
    return "\n\n".join(parts)


async def generate_flashcards(documents: list[DocumentData]) -> list[dict]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    context = await _build_context(documents)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": f"Document content:\n\n{context}"},
        ],
        temperature=0.5,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content or "[]"
    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        cards = json.loads(raw)
        if not isinstance(cards, list):
            return []
        return [c for c in cards if isinstance(c, dict) and "question" in c and "answer" in c]
    except json.JSONDecodeError:
        return []
