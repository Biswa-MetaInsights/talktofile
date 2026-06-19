"""
Analyst Agent — chunks the document, generates embeddings, builds in-memory FAISS index,
produces a summary and suggested starter questions.
"""

import asyncio
import numpy as np
import faiss
import tiktoken
from openai import AsyncOpenAI
from core.config import get_settings

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
CHUNK_TOKENS = 400
CHUNK_OVERLAP = 60
ENCODING = tiktoken.get_encoding("cl100k_base")


def _tokenize(text: str) -> list[int]:
    return ENCODING.encode(text)


def _detokenize(tokens: list[int]) -> str:
    return ENCODING.decode(tokens)


def chunk_text(text: str) -> list[str]:
    tokens = _tokenize(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_TOKENS, len(tokens))
        chunks.append(_detokenize(tokens[start:end]))
        start += CHUNK_TOKENS - CHUNK_OVERLAP
    return chunks


async def embed_texts(texts: list[str], client: AsyncOpenAI) -> np.ndarray:
    batch_size = 100
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(model=EMBED_MODEL, input=batch)
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)
    return np.array(all_embeddings, dtype=np.float32)


def build_faiss_index(embeddings: np.ndarray) -> faiss.IndexFlatIP:
    faiss.normalize_L2(embeddings)
    index = faiss.IndexFlatIP(EMBED_DIM)
    index.add(embeddings)
    return index


def _parse_summary(raw: str) -> dict:
    """Normalise the model's JSON into our structured summary shape."""
    import json
    fallback = {"overview": "", "doc_type": "", "key_points": [], "topics": []}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {**fallback, "overview": raw[:400]}
    if not isinstance(data, dict):
        return fallback
    return {
        "overview": str(data.get("overview", "")).strip(),
        "doc_type": str(data.get("doc_type", "")).strip(),
        "key_points": [str(p).strip() for p in (data.get("key_points") or []) if str(p).strip()][:6],
        "topics": [str(t).strip() for t in (data.get("topics") or []) if str(t).strip()][:8],
    }


def summary_to_text(summary: dict) -> str:
    """Flatten a structured summary to a short string (for multi-doc prompts)."""
    if not isinstance(summary, dict):
        return str(summary or "")
    parts = [summary.get("overview", "")]
    parts += [f"- {p}" for p in summary.get("key_points", [])]
    return "\n".join(p for p in parts if p)


def _spread_sample(text: str, limit: int = 14000) -> str:
    """Sample across the whole document (start + middle + end) so the summary
    reflects all of it, not just the first few pages."""
    if len(text) <= limit:
        return text
    third = limit // 3
    head = text[:third]
    mid_start = (len(text) - third) // 2
    middle = text[mid_start:mid_start + third]
    tail = text[-third:]
    return f"{head}\n\n[...]\n\n{middle}\n\n[...]\n\n{tail}"


async def generate_summary(text: str, client: AsyncOpenAI) -> dict:
    sample = _spread_sample(text)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a document analyst. Analyse the document and return a JSON object with:\n"
                    "- 'overview': one engaging, plain-language sentence capturing what the document is and its purpose.\n"
                    "- 'doc_type': a short label (e.g. Report, Contract, Research Paper, Invoice, Slide Deck, Resume).\n"
                    "- 'key_points': an array of 3-5 short, punchy takeaways (each a brief phrase, not a paragraph).\n"
                    "- 'topics': an array of 3-6 one-or-two-word topic tags.\n"
                    "ALWAYS write everything in English, even if the document is in another language."
                ),
            },
            {"role": "user", "content": f"Document content:\n\n{sample}"},
        ],
        temperature=0.3,
        max_tokens=500,
        response_format={"type": "json_object"},
    )
    return _parse_summary(response.choices[0].message.content.strip())


def _parse_questions(raw: str, limit: int = 5) -> list[str]:
    import json
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    questions = data.get("questions") if isinstance(data, dict) else None
    if questions is None and isinstance(data, dict) and data:
        first = list(data.values())[0]
        questions = first if isinstance(first, list) else []
    if not isinstance(questions, list):
        return []
    return [str(q) for q in questions][:limit]


async def generate_suggested_questions(text: str, client: AsyncOpenAI) -> list[str]:
    sample = text[:6000]
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a curious analyst. Based on the document, generate exactly 4 insightful, "
                    "specific questions a reader would genuinely want answered. "
                    "ALWAYS write the questions in English, even if the document is in another language. "
                    "Return as a JSON array of strings under the key 'questions'. No explanation."
                ),
            },
            {"role": "user", "content": f"Document:\n\n{sample}"},
        ],
        temperature=0.7,
        max_tokens=300,
        response_format={"type": "json_object"},
    )
    return _parse_questions(response.choices[0].message.content.strip(), 4)


async def generate_multi_doc_questions(
    summaries: list[tuple[str, str]], mode: str, client: AsyncOpenAI
) -> list[str]:
    """Suggested questions/actions tailored to comparing or working across multiple files.

    summaries: list of (filename, summary). mode: "compare" (2 files) or "multi" (3-5 files).
    """
    catalogue = "\n\n".join(
        f"FILE {i+1}: {name}\nSummary: {summ}" for i, (name, summ) in enumerate(summaries)
    )

    if mode == "compare":
        guidance = (
            "The user has uploaded exactly 2 documents to compare. Generate exactly 5 insightful "
            "comparison-oriented questions covering: key differences, similarities/overlap, "
            "contradictions or mistakes between them, which is stronger/more complete, and a merge/recommendation. "
            "Reference the files by their names where natural."
        )
    else:
        guidance = (
            "The user has uploaded several documents. Generate exactly 5 useful actions/questions a "
            "reader would want across this set: e.g. summarise common themes, find differences, "
            "identify the most relevant file for a topic, spot inconsistencies, and consolidate key points. "
            "Reference the files by their names where natural."
        )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"{guidance} ALWAYS write the questions in English. "
                    "Return a JSON object with a 'questions' key holding an array of strings. No explanation."
                ),
            },
            {"role": "user", "content": catalogue},
        ],
        temperature=0.7,
        max_tokens=400,
        response_format={"type": "json_object"},
    )
    return _parse_questions(response.choices[0].message.content.strip(), 5)


async def retrieve_chunks(
    query: str,
    index: faiss.IndexFlatIP,
    chunks: list[str],
    client: AsyncOpenAI,
    top_k: int = 5,
) -> list[tuple[str, float]]:
    q_embed = await embed_texts([query], client)
    faiss.normalize_L2(q_embed)
    scores, indices = index.search(q_embed, top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx != -1:
            results.append((chunks[idx], float(score)))
    return results


async def analyse_one(text: str, client: AsyncOpenAI) -> tuple[list[str], np.ndarray, faiss.IndexFlatIP, dict]:
    """Chunk, embed, index and summarise a single document.

    Returns: (chunks, embeddings, faiss_index, summary_dict)
    """
    chunks = chunk_text(text)
    embeddings, summary = await asyncio.gather(
        embed_texts(chunks, client),
        generate_summary(text, client),
    )
    index = build_faiss_index(embeddings.copy())
    return chunks, embeddings, index, summary


async def analyse_document(text: str) -> tuple[list[str], np.ndarray, faiss.IndexFlatIP, str, list[str]]:
    """
    Returns: (chunks, embeddings, faiss_index, summary, suggested_questions)
    """
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    (chunks, embeddings, index, summary), questions = await asyncio.gather(
        analyse_one(text, client),
        generate_suggested_questions(text, client),
    )
    return chunks, embeddings, index, summary, questions
