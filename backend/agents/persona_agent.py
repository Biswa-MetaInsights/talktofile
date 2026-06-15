"""
Persona Agent — turns a user's domain answers into a custom system prompt
that shapes Sage's personality and expertise for that user.
"""

from openai import AsyncOpenAI
from core.config import get_settings

_SYSTEM = """You are a prompt engineer. Given a few details about a professional and their
domain, write a concise system-prompt persona for "Sage", a document Q&A assistant.

The persona must:
- Define who Sage is for THIS user (role + domain expertise).
- Specify the tone, vocabulary, and conventions of that field.
- Reference any sub-specialty or jurisdiction the user mentioned.
- Be 2–4 sentences. Start with "You are ...".
- NOT include rules about answering only from the document or formatting — those are added separately.

Output ONLY the persona text, nothing else.
"""

# Hard ceiling so a stored persona can never balloon the prompt.
MAX_PERSONA_LEN = 1200


async def generate_persona(role: str, specialty: str, address_as: str) -> str:
    """Build a custom Sage persona prompt from the user's signup answers."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    details = (
        f"Role / field: {role or 'not specified'}\n"
        f"Specialty / focus: {specialty or 'not specified'}\n"
        f"Address the user as: {address_as or 'not specified'}"
    )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": details},
        ],
        max_tokens=200,
        temperature=0.5,
    )

    persona = response.choices[0].message.content.strip()
    return persona[:MAX_PERSONA_LEN]