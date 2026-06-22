"""
Translate Agent — translates document text into a target language.
Works on the raw extracted text of each document in the session.
"""

from openai import AsyncOpenAI
from core.session_store import DocumentData
from core.config import get_settings

# Languages that contain image data the agent cannot process
_UNSUPPORTED_NOTE = (
    "Note: Translation covers only the text content of your document. "
    "Images, charts, and scanned pages cannot be translated."
)

_SYSTEM = (
    "You are a professional translator. Translate the provided document text accurately "
    "into the target language. Preserve the structure (headings, bullet points, paragraphs). "
    "Translate ONLY the text — do not add commentary or explanations. "
    "If a word is a proper noun, acronym, or has no natural translation, keep it as-is."
)


async def translate_document(documents: list[DocumentData], target_language: str) -> dict:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    results = []
    for doc in documents:
        # Use chunks joined as text; fall back to raw_text for tabulars
        if doc.is_tabular:
            results.append({
                "filename": doc.filename,
                "translated_text": None,
                "error": "Spreadsheet/table files cannot be translated — only text-based documents are supported.",
            })
            continue

        source_text = "\n\n".join(doc.chunks)[:12000] if doc.chunks else doc.raw_text[:12000]
        if not source_text.strip():
            results.append({"filename": doc.filename, "translated_text": "", "error": None})
            continue

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": f"Translate the following text into {target_language}:\n\n{source_text}",
                },
            ],
            temperature=0.3,
            max_tokens=4000,
        )
        translated = response.choices[0].message.content or ""
        results.append({"filename": doc.filename, "translated_text": translated, "error": None})

    return {
        "target_language": target_language,
        "documents": results,
        "note": _UNSUPPORTED_NOTE,
    }
