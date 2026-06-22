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

_SYSTEM = """You are a professional translator and document analyst.

The text you receive was extracted from a PDF or document file. Depending on how the PDF was created,
the raw extracted text may contain:
- Garbled characters or symbols (from custom/embedded non-standard font encodings)
- Mixed readable English and garbled non-Latin script text
- Partially readable content with some encoding artifacts

Your job:
1. FIRST, interpret and reconstruct the meaningful content. Use the document context/summary provided
   to understand what the document is about and help decode garbled portions.
2. THEN, translate that reconstructed content into the target language.
3. Preserve document structure: headings, numbered items, bullet points, sections.
4. For any portion that is completely unreadable (pure garbled characters with no recoverable meaning),
   write: [unreadable section]
5. Translate ONLY — no commentary, no explanations of what you did.
6. Proper nouns, acronyms, and untranslatable technical terms: keep them as-is."""


def _build_context_header(doc: DocumentData) -> str:
    """Build a summary context block to help GPT-4o understand the document before translating."""
    if not isinstance(doc.summary, dict):
        return ""
    s = doc.summary
    parts = []
    if s.get("doc_type"):
        parts.append(f"Document type: {s['doc_type']}")
    if s.get("overview"):
        parts.append(f"Overview: {s['overview']}")
    if s.get("key_points"):
        parts.append("Key points: " + "; ".join(s["key_points"][:5]))
    if s.get("topics"):
        parts.append("Topics: " + ", ".join(s["topics"]))
    return "\n".join(parts)


async def translate_document(documents: list[DocumentData], target_language: str) -> dict:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    results = []
    for doc in documents:
        if doc.is_tabular:
            results.append({
                "filename": doc.filename,
                "translated_text": None,
                "error": "Spreadsheet/table files cannot be translated — only text-based documents are supported.",
            })
            continue

        # Prefer raw_text (complete extraction) over chunks (chunked for RAG).
        # raw_text preserves document order better; chunks may repeat context headers.
        source_text = (doc.raw_text or "\n\n".join(doc.chunks))[:14000]
        if not source_text.strip():
            results.append({"filename": doc.filename, "translated_text": "", "error": None})
            continue

        context_header = _build_context_header(doc)
        user_message = (
            f"Translate the following document into {target_language}.\n\n"
            + (f"DOCUMENT CONTEXT (use this to interpret any garbled/encoded text):\n{context_header}\n\n" if context_header else "")
            + f"RAW DOCUMENT TEXT:\n{source_text}"
        )

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_message},
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
