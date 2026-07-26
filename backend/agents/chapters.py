"""
Chapter / section segmentation.

Documents have no inherent chapter structure, so we derive one with a cheap text
heuristic (no model call):

  1. Detect heading lines — "Chapter N", "Section N", "Part N", markdown "# …", and
     conservative numbered headings ("1. Title") — and split the text at them.
  2. If fewer than two headings are found, fall back to page ranges using the
     "[Page N]" markers the PDF extractor inserts.
  3. If there are no page markers either (docx/txt/web), the whole document is one
     chapter.

Each chapter is stored as {index, id, title, start, end} where start/end are char
offsets into the document's raw_text — so the text of any chapter is just
raw_text[start:end] and we never duplicate the content in memory.
"""

import re

# "Chapter 1", "CHAPTER I", "Chapitre 2", "Kapitel 3", "Capítulo 4", "Part 2", "Section 3"
_KEYWORD_HEADING = re.compile(
    r"^\s*(chapter|chapitre|kapitel|cap[ií]tulo|part|section)\s+"
    r"([0-9]{1,3}|[ivxlcdm]{1,6})\b",
    re.IGNORECASE,
)
# Markdown heading: "# Title" … "### Title"
_MD_HEADING = re.compile(r"^\s*#{1,3}\s+\S")
# Conservative numbered heading: "1. Title" / "2 Title" / "1.1 Title" — short, starts
# with a capital, not ending like a normal sentence (no trailing period + more text).
_NUM_HEADING = re.compile(r"^\s*\d+(\.\d+)*\.?\s+[A-Z][^\n]{2,70}$")
# Page / slide markers inserted by the extractor — never treat these as headings.
_PAGE_MARKER = re.compile(r"^\s*\[(Page|Slide)\s+(\d+)\]\s*$", re.IGNORECASE)

# If this much readable text precedes the first heading, keep it as its own
# "Introduction" chapter instead of folding it into chapter 1.
_INTRO_MIN_CHARS = 200


def _clean_title(line: str, max_len: int = 70) -> str:
    title = line.strip().lstrip("#").strip()
    title = re.sub(r"\s+", " ", title)
    return title[:max_len].rstrip(" -–—:")


def _is_heading(stripped: str) -> bool:
    if not stripped or _PAGE_MARKER.match(stripped):
        return False
    if _KEYWORD_HEADING.match(stripped) or _MD_HEADING.match(stripped):
        return True
    if _NUM_HEADING.match(stripped):
        return True
    return False


def _mk(index: int, title: str, start: int, end: int) -> dict:
    return {"index": index, "id": f"ch{index + 1}", "title": title, "start": start, "end": end}


def _by_headings(raw_text: str) -> list[dict] | None:
    """Split at heading lines. Returns None if fewer than two headings are found."""
    headings: list[tuple[int, str]] = []  # (char offset of line start, title)
    offset = 0
    for line in raw_text.split("\n"):
        if _is_heading(line.strip()):
            headings.append((offset, _clean_title(line)))
        offset += len(line) + 1  # +1 for the split '\n'

    if len(headings) < 2:
        return None

    chapters: list[dict] = []
    first_off = headings[0][0]
    # Front matter before the first heading → its own "Introduction" chapter if it's
    # substantial; otherwise let chapter 1 start at 0 and absorb it.
    body_start = first_off
    if raw_text[:first_off].strip() and len(raw_text[:first_off].strip()) >= _INTRO_MIN_CHARS:
        chapters.append(_mk(0, "Introduction", 0, first_off))
    else:
        body_start = 0

    for i, (off, title) in enumerate(headings):
        start = body_start if (i == 0 and not chapters) else off
        end = headings[i + 1][0] if i + 1 < len(headings) else len(raw_text)
        chapters.append(_mk(len(chapters), title, start, end))
    return chapters


def _by_pages(raw_text: str) -> list[dict] | None:
    """Split at "[Page N]" / "[Slide N]" markers. None if fewer than two pages."""
    marks: list[tuple[int, str]] = []
    offset = 0
    for line in raw_text.split("\n"):
        m = _PAGE_MARKER.match(line.strip())
        if m:
            marks.append((offset, f"{m.group(1).title()} {m.group(2)}"))
        offset += len(line) + 1

    if len(marks) < 2:
        return None

    chapters: list[dict] = []
    for i, (off, title) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(raw_text)
        chapters.append(_mk(i, title, off, end))
    return chapters


def segment_into_chapters(raw_text: str) -> list[dict]:
    """Return an ordered list of chapter dicts {index, id, title, start, end}.

    Always returns at least one chapter (the whole document) so callers can rely on
    a non-empty list.
    """
    raw_text = raw_text or ""
    if not raw_text.strip():
        return [_mk(0, "Full document", 0, len(raw_text))]

    return (
        _by_headings(raw_text)
        or _by_pages(raw_text)
        or [_mk(0, "Full document", 0, len(raw_text))]
    )


def public_chapters(chapters: list[dict]) -> list[dict]:
    """Strip the internal char offsets — the frontend only needs id/index/title."""
    return [{"id": c["id"], "index": c["index"], "title": c["title"]} for c in chapters]


def chapters_text(raw_text: str, chapters: list[dict], chapter_ids: list[str] | None) -> str:
    """Concatenate the text of the requested chapters (in document order).

    `chapter_ids` None/empty → the whole document. Unknown ids are ignored; if none of
    the ids match, falls back to the whole document rather than returning nothing.
    """
    if not chapter_ids:
        return raw_text
    wanted = set(chapter_ids)
    selected = [c for c in chapters if c["id"] in wanted]
    if not selected:
        return raw_text
    selected.sort(key=lambda c: c["index"])
    return "\n\n".join(raw_text[c["start"]:c["end"]] for c in selected)
