"""
Podcast Agent — generates a two-person conversation script about document content.
Returns a list of {speaker, text} dicts representing the dialogue.
"""

import json
from openai import AsyncOpenAI
from core.session_store import DocumentData
from core.config import get_settings


_SYSTEM = """You are a podcast script writer. Given document content, create an engaging two-person
conversation between HOST (an experienced interviewer) and EXPERT (a domain specialist who has
deeply studied this document). The conversation should:

- Start with a brief introduction of the topic
- Cover the key ideas, facts, and insights from the document
- Use natural, conversational language (not formal/academic)
- Include moments where HOST asks follow-up questions or clarifications
- End with key takeaways or actionable insights
- Run approximately 800-1200 words total

The conversation must be grounded in the document — do not invent facts not present in it.

Return ONLY a JSON array (no markdown, no extra text):
[
  {"speaker": "HOST", "text": "..."},
  {"speaker": "EXPERT", "text": "..."},
  ...
]"""


def _build_context(documents: list[DocumentData]) -> str:
    parts = []
    for doc in documents:
        if isinstance(doc.summary, dict):
            s = doc.summary
            overview = s.get("overview", "")
            kps = "; ".join(s.get("key_points", []))
            topics = ", ".join(s.get("topics", []))
            parts.append(
                f"=== {doc.filename} ===\n"
                f"Overview: {overview}\nKey points: {kps}\nTopics: {topics}"
            )
        if doc.chunks:
            content = "\n\n".join(doc.chunks)[:8000]
            parts.append(f"Content:\n{content}")
    return "\n\n".join(parts)


_EXTEND_SYSTEM = """You are a podcast script writer continuing an existing two-person conversation
between HOST (interviewer) and EXPERT (domain specialist). Given the conversation so far and a
user request, generate ONLY the new continuation dialogue segments.

Rules:
- Continue naturally from where the conversation left off — do not repeat anything already said.
- Focus the continuation on what the user requested (e.g. "go deeper on X", "add more about Y").
- Stay grounded in the document — do not invent facts not in it.
- Generate 4–10 new exchanges (not a full new podcast).
- Return ONLY a JSON array (no markdown, no extra text):
[
  {"speaker": "HOST", "text": "..."},
  {"speaker": "EXPERT", "text": "..."},
  ...
]"""


async def extend_podcast(documents: list[DocumentData], existing_script: list[dict], user_request: str) -> list[dict]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    context = _build_context(documents)

    existing_text = "\n".join(f'{s["speaker"]}: {s["text"]}' for s in existing_script[-12:])

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _EXTEND_SYSTEM},
            {"role": "user", "content": (
                f"Document content:\n\n{context}\n\n"
                f"Conversation so far (last section):\n{existing_text}\n\n"
                f"User request: {user_request}"
            )},
        ],
        temperature=0.7,
        max_tokens=2000,
    )

    raw = (response.choices[0].message.content or "[]").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        new_lines = json.loads(raw)
        if not isinstance(new_lines, list):
            return []
        return [s for s in new_lines if isinstance(s, dict) and "speaker" in s and "text" in s]
    except json.JSONDecodeError:
        return []


async def generate_podcast(documents: list[DocumentData]) -> list[dict]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    context = _build_context(documents)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"Document content:\n\n{context}"},
        ],
        temperature=0.7,
        max_tokens=4000,
    )

    raw = (response.choices[0].message.content or "[]").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        script = json.loads(raw)
        if not isinstance(script, list):
            return []
        return [s for s in script if isinstance(s, dict) and "speaker" in s and "text" in s]
    except json.JSONDecodeError:
        return []
