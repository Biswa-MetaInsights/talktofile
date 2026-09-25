"""
Slide Agent — generates a presentation-grade slide deck from document content.

The model picks a *layout* per slide (cover, agenda, section divider, bullets, big-number
stats, two-column comparison, process, cards, quote, closing). The frontend renders an
HTML preview of each layout (SlidesView `SlideCanvas`) and `build_pptx` renders the same
layout into an editable .pptx with python-pptx.

Both renderers share ONE coordinate system: a slide is 100 units wide × 56.25 tall
(16:9), where 1 unit = 1% of the slide width (`cqw` in the HTML preview). Font sizes are
in the same units. Keep the geometry and palettes below in sync with SlidesView.tsx.
"""

import io
import json
from openai import AsyncOpenAI
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from core.session_store import DocumentData
from core.config import get_settings


LAYOUTS = (
    "title", "agenda", "section", "content", "stats",
    "comparison", "process", "cards", "quote", "closing",
)

_SCHEMA = """Slide layouts (the "type" field) and their fields:
- "title":      {"type":"title","title":"...","subtitle":"..."}  — the cover. Always slide 1.
- "agenda":     {"type":"agenda","title":"Agenda","bullets":["3-5 short section names"]}
- "section":    {"type":"section","title":"Section name","subtitle":"one-line framing"} — a divider before a major part.
- "content":    {"type":"content","title":"...","bullets":["3-4 bullets, max 12 words each"]}
- "stats":      {"type":"stats","title":"...","items":[{"heading":"42%","text":"what the number means, max 10 words"}]} — 2-4 items. heading is ONLY the bare figure, max 6 characters (e.g. "42%", "$54M", "14", "3.1x") — put every word (units, what it counts) in text.
- "comparison": {"type":"comparison","title":"...","columns":[{"heading":"...","points":["2-4 points"]},{"heading":"...","points":["..."]}]} — exactly 2 columns.
- "process":    {"type":"process","title":"...","items":[{"heading":"step name, 1-3 words","text":"max 12 words"}]} — 3-5 sequential steps.
- "cards":      {"type":"cards","title":"...","items":[{"heading":"1-4 words","text":"max 16 words"}]} — 3-4 parallel ideas/pillars/features.
- "quote":      {"type":"quote","quote":"a verbatim sentence from the document","attribution":"who said it / source"}
- "closing":    {"type":"closing","title":"a short closing line","subtitle":"one-line call to action or final message"} — always the last slide.
Every slide may also carry "speaker_note" (1-2 sentences for the presenter)."""

_SYSTEM = f"""You are a world-class presentation designer (think top-tier consulting decks and polished keynote talks).
Turn the document into a crisp, visually varied slide deck.

{_SCHEMA}

Design rules:
- 9-12 slides. Slide 1 is "title"; slide 2 is "agenda"; the last slide is "closing"; the slide before it summarises the key takeaways ("content" or "cards").
- Use AT LEAST 5 different layouts. Never put more than two "content" slides in a row — prefer stats, cards, process, and comparison wherever the material fits them.
- Use 1-3 "section" dividers only if the deck has distinct parts.
- Titles are insight headlines that state the point ("Costs fell 30% after automation"), not topic labels ("Costs"). Max 8 words.
- "stats" ONLY with real figures that appear in the document — never invent, estimate, or round numbers the document doesn't give. If the document has no figures, don't use "stats".
- "quote" ONLY for a sentence that appears verbatim in the document. Otherwise skip it.
- Be concise: fragments over sentences, no trailing periods on bullets, no filler.
- Everything must come from the document. Write in clear English.

Return ONLY a JSON object: {{"slides": [ ...slide objects... ]}}"""


_REFINE_SYSTEM = f"""You are a presentation editor. You are given an EXISTING slide deck (JSON) and an
instruction from the user describing how to change it. Apply the instruction and return the FULL updated deck.

{_SCHEMA}

Rules:
- Preserve slides and content the user did not ask to change. Only modify what the instruction implies
  (rewording, adding/removing/reordering slides, switching a slide's layout, shortening, tone, etc.).
- Keep slide 1 a "title" slide. Keep titles to ~8 words and bullets concise.
- Never invent numbers or quotes that aren't in the document.

Return ONLY a JSON object: {{"slides": [ ...slide objects... ]}}"""


def _build_context(documents: list[DocumentData], max_chars: int) -> str:
    parts = []
    for doc in documents:
        if isinstance(doc.summary, dict):
            s = doc.summary
            parts.append(
                f"=== {doc.filename} ===\n"
                f"Overview: {s.get('overview','')}\n"
                f"Key points: {'; '.join(s.get('key_points', []))}\n"
                f"Topics: {', '.join(s.get('topics', []))}"
            )
        if doc.chunks:
            content = "\n\n".join(doc.chunks)[:max_chars]
            parts.append(f"Content:\n{content}")
    return "\n\n".join(parts)


# ── Parsing + normalisation ───────────────────────────────────────────────────
# The renderers trust the shape, so every slide is coerced into a valid layout here.

def _s(v) -> str:
    return v.strip() if isinstance(v, str) else ("" if v is None else str(v).strip())


def _str_list(v, cap: int) -> list[str]:
    if not isinstance(v, list):
        return []
    return [t for t in (_s(x) for x in v) if t][:cap]


def _items(v, cap: int) -> list[dict]:
    out = []
    if isinstance(v, list):
        for it in v:
            if isinstance(it, dict):
                h, t = _s(it.get("heading")), _s(it.get("text"))
            else:
                h, t = "", _s(it)
            if h or t:
                out.append({"heading": h, "text": t})
    return out[:cap]


def _normalize_slide(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    kind = _s(raw.get("type")) or "content"
    if kind not in LAYOUTS:
        kind = "content"
    slide: dict = {"type": kind, "title": _s(raw.get("title"))}
    note = _s(raw.get("speaker_note"))
    if note:
        slide["speaker_note"] = note

    if kind in ("title", "section", "closing"):
        slide["subtitle"] = _s(raw.get("subtitle"))
    elif kind in ("content", "agenda"):
        slide["bullets"] = _str_list(raw.get("bullets"), 6)
    elif kind in ("stats", "process", "cards"):
        cap = {"stats": 4, "process": 5, "cards": 4}[kind]
        slide["items"] = _items(raw.get("items"), cap)
        if not slide["items"]:  # nothing to lay out → degrade to bullets
            slide = {**slide, "type": "content", "bullets": _str_list(raw.get("bullets"), 6)}
            slide.pop("items", None)
    elif kind == "comparison":
        cols = []
        for c in raw.get("columns") or []:
            if isinstance(c, dict):
                cols.append({"heading": _s(c.get("heading")), "points": _str_list(c.get("points"), 5)})
        cols = cols[:2]
        while len(cols) < 2:
            cols.append({"heading": "", "points": []})
        slide["columns"] = cols
    elif kind == "quote":
        slide["quote"] = _s(raw.get("quote")) or slide["title"]
        slide["attribution"] = _s(raw.get("attribution"))
    return slide


def _parse_slides(raw: str) -> list[dict]:
    raw = (raw or "[]").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = data.get("slides", [])
    if not isinstance(data, list):
        return []
    return [s for s in (_normalize_slide(x) for x in data) if s]


async def generate_slides_data(documents: list[DocumentData], plan: str = "free") -> list[dict]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    context = _build_context(documents, settings.slides_context_chars(plan))

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"Document content:\n\n{context}"},
        ],
        temperature=0.5,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )

    return _parse_slides(response.choices[0].message.content)


async def refine_slides_data(
    documents: list[DocumentData], current_slides: list[dict], instruction: str, plan: str = "free"
) -> list[dict]:
    """Apply a natural-language instruction to an existing deck and return the full
    updated deck. The source document is provided as context so the model can add
    genuinely new, grounded slides when asked."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    context = _build_context(documents, settings.slides_context_chars(plan))

    user_msg = (
        f"Source document (for grounding any additions):\n\n{context}\n\n"
        f"Existing slide deck (JSON):\n{json.dumps({'slides': current_slides}, ensure_ascii=False)}\n\n"
        f"Instruction: {instruction}"
    )

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _REFINE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.4,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )

    refined = _parse_slides(response.choices[0].message.content)
    # Never wipe the deck on a bad parse — fall back to what we had.
    return refined or current_slides


# ── Theming ───────────────────────────────────────────────────────────────────
# Mirrors `palette()` in SlidesView.tsx — keep the hex values identical.

_DEFAULT_ACCENT = "#E2611B"  # brand orange
_PRESETS = {"classic", "minimal", "bold"}
_FONT = "Calibri"  # the preview uses Inter; Calibri is the closest face every Office install has


def _hex(value) -> str:
    """Normalise '#RGB' / '#RRGGBB' to '#RRGGBB'; fall back to the brand orange."""
    if isinstance(value, str):
        v = value.strip().lstrip("#")
        if len(v) == 3:
            v = "".join(c * 2 for c in v)
        if len(v) == 6:
            try:
                int(v, 16)
                return "#" + v.upper()
            except ValueError:
                pass
    return _DEFAULT_ACCENT


def _rgb_tuple(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def _mix(a: str, b: str, t: float) -> str:
    """Blend colour a toward b by t (0..1)."""
    ra, ga, ba = _rgb_tuple(a)
    rb, gb, bb = _rgb_tuple(b)
    return "#{:02X}{:02X}{:02X}".format(
        round(ra + (rb - ra) * t), round(ga + (gb - ga) * t), round(ba + (bb - ba) * t)
    )


def _on(color: str) -> str:
    """Readable text colour (white or near-black) on top of `color`."""
    r, g, b = _rgb_tuple(color)
    return "#0F172A" if (0.299 * r + 0.587 * g + 0.114 * b) > 170 else "#FFFFFF"


def palette(preset: str, accent: str) -> dict:
    if preset == "minimal":  # editorial: warm paper, ink text, accent used sparingly
        p = dict(bg="#FAFAF7", surface="#FFFFFF", text="#1C1917", muted="#78716C", rule="#E7E5E4")
        p.update(hero_bg=p["bg"], hero_text=p["text"], hero_muted=p["muted"])
    elif preset == "bold":  # dark keynote
        p = dict(bg="#0B1020", surface="#161C2E", text="#F8FAFC", muted="#94A3B8", rule="#26304A")
        p.update(hero_bg=p["bg"], hero_text="#FFFFFF", hero_muted=p["muted"])
    else:  # classic: clean corporate, full-bleed accent on hero slides
        p = dict(bg="#FFFFFF", surface="#F4F6F9", text="#0F172A", muted="#64748B", rule="#E2E8F0")
        on = _on(accent)
        p.update(hero_bg=accent, hero_text=on, hero_muted=_mix(accent, on, 0.78))
    p.update(accent=accent, on_accent=_on(accent))
    return p


# ── Low-level drawing (all geometry in slide units: 100 wide × 56.25 tall) ────

_SLIDE_W_IN = 13.333


def _u(v: float) -> Emu:
    return Emu(int(v * _SLIDE_W_IN / 100 * 914400))


def _fs(v: float) -> Pt:
    return Pt(round(v * _SLIDE_W_IN * 72 / 100, 1))


def _rgb(h: str) -> RGBColor:
    return RGBColor(*_rgb_tuple(h))


def _bg(slide, color: str):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = _rgb(color)


def _shape(slide, kind, x, y, w, h, color: str, radius: float = 0):
    if radius and kind == MSO_SHAPE.RECTANGLE:
        kind = MSO_SHAPE.ROUNDED_RECTANGLE
    shp = slide.shapes.add_shape(kind, _u(x), _u(y), _u(w), _u(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = _rgb(color)
    shp.line.fill.background()
    shp.shadow.inherit = False
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = min(0.5, radius / min(w, h))
    return shp


def _rect(slide, x, y, w, h, color, radius=0):
    return _shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, color, radius)


def _oval(slide, x, y, d, color):
    return _shape(slide, MSO_SHAPE.OVAL, x, y, d, d, color)


def _text(slide, x, y, w, h, text, size, color, bold=False, italic=False,
          align="l", anchor="t", spacing=1.15):
    box = slide.shapes.add_textbox(_u(x), _u(y), _u(w), _u(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    lines = text.split("\n") if text else [""]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
        p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        f = r.font
        f.name = _FONT
        f.size = _fs(size)
        f.bold = bold
        f.italic = italic
        f.color.rgb = _rgb(color)
    return box


# ── Slide chrome ──────────────────────────────────────────────────────────────

MX = 6          # side margin
BODY_Y = 17     # where layout bodies start


def _chrome(slide, p, title, deck_title, number):
    """Background, accent tick, headline, and footer shared by every body slide."""
    _bg(slide, p["bg"])
    _rect(slide, MX, 5.6, 3.2, 0.45, p["accent"])
    _text(slide, MX, 7.4, 88, 8, title, 3.3, p["text"], bold=True, spacing=1.05)
    _rect(slide, MX, 50.6, 100 - 2 * MX, 0.12, p["rule"])
    _text(slide, MX, 51.8, 70, 2.5, deck_title, 1.15, p["muted"])
    _text(slide, 100 - MX - 10, 51.8, 10, 2.5, f"{number:02d}", 1.15, p["muted"], bold=True, align="r")


def _hero_bg(slide, p, preset):
    """Background + decoration for cover / section / closing slides."""
    _bg(slide, p["hero_bg"])
    if preset == "classic":
        _oval(slide, 64, -14, 52, _mix(p["accent"], "#FFFFFF", 0.10))
        _oval(slide, 80, 30, 34, _mix(p["accent"], "#000000", 0.08))
    elif preset == "bold":
        _rect(slide, 72, 0, 28, 56.25, p["accent"])
        _oval(slide, 78, 16, 24, _mix(p["accent"], "#000000", 0.18))
    else:  # minimal
        _rect(slide, MX, 6, 1.8, 1.8, p["accent"])
        _rect(slide, MX, 46.5, 100 - 2 * MX, 0.12, p["rule"])


def _hero_width(preset):
    return 60 if preset == "bold" else 64


# ── Layouts ───────────────────────────────────────────────────────────────────

def _build_title(slide, d, p, preset, author):
    _hero_bg(slide, p, preset)
    w = _hero_width(preset)
    _text(slide, MX, 15, w, 18, d.get("title") or "Untitled", 5.6, p["hero_text"], bold=True,
          anchor="b", spacing=1.0)
    _rect(slide, MX, 35, 8, 0.5, p["hero_text"] if preset == "classic" else p["accent"])
    if d.get("subtitle"):
        _text(slide, MX, 37.5, w, 6, d["subtitle"], 2.0, p["hero_muted"])
    if author:
        _text(slide, MX, 48.5, w, 3, f"Created by {author}", 1.35,
              p["hero_muted"] if preset == "classic" else p["accent"], bold=True)


def _build_section(slide, d, p, preset, section_no):
    _hero_bg(slide, p, preset)
    w = _hero_width(preset)
    num_color = p["hero_muted"] if preset == "classic" else p["accent"]
    _text(slide, MX, 10, w, 12, f"{section_no:02d}", 9, num_color, bold=True, anchor="b", spacing=1.0)
    _text(slide, MX, 23.5, w, 13, d.get("title", ""), 4.6, p["hero_text"], bold=True, spacing=1.05)
    if d.get("subtitle"):
        _text(slide, MX, 39, w, 6, d["subtitle"], 1.9, p["hero_muted"])


def _build_closing(slide, d, p, preset, author):
    _hero_bg(slide, p, preset)
    w = _hero_width(preset)
    _text(slide, MX, 14, w, 18, d.get("title") or "Thank you", 5.6, p["hero_text"], bold=True,
          anchor="b", spacing=1.0)
    _rect(slide, MX, 34, 8, 0.5, p["hero_text"] if preset == "classic" else p["accent"])
    if d.get("subtitle"):
        _text(slide, MX, 36.5, w, 8, d["subtitle"], 2.0, p["hero_muted"])
    if author:
        _text(slide, MX, 48.5, w, 3, author, 1.35,
              p["hero_muted"] if preset == "classic" else p["accent"], bold=True)


def _build_content(slide, d, p):
    bullets = d.get("bullets") or []
    n = max(len(bullets), 1)
    row = min(7.5, 31 / n)
    for i, b in enumerate(bullets):
        y = BODY_Y + 1 + i * row
        _rect(slide, MX, y + 0.75, 0.9, 0.9, p["accent"])
        _text(slide, MX + 3, y, 84, row, b, 2.0, p["text"], spacing=1.15)
        if i < len(bullets) - 1:
            _rect(slide, MX + 3, y + row - 1.1, 85, 0.08, p["rule"])


def _build_agenda(slide, d, p):
    items = d.get("bullets") or []
    n = max(len(items), 1)
    row = min(6.5, 31 / n)
    for i, t in enumerate(items):
        y = BODY_Y + 1 + i * row
        _text(slide, MX, y, 6, row, f"{i + 1:02d}", 2.4, p["accent"], bold=True)
        _text(slide, MX + 7, y + 0.2, 80, row, t, 2.1, p["text"])
        _rect(slide, MX + 7, y + row - 1.0, 81, 0.08, p["rule"])


def _cols(n, gap=2.4, width=100 - 2 * MX):
    w = (width - gap * (n - 1)) / n
    return [(MX + i * (w + gap), w) for i in range(n)]


def _build_stats(slide, d, p):
    items = d.get("items") or []
    for (x, w), it in zip(_cols(max(len(items), 1)), items):
        _rect(slide, x, BODY_Y + 2, w, 27, p["surface"], radius=1.2)
        _rect(slide, x, BODY_Y + 2, 0.5, 27, p["accent"])
        size = 5.4 if len(it["heading"]) <= 6 else 3.4  # long figures shrink rather than overflow
        _text(slide, x + 2.8, BODY_Y + 5, w - 5, 10, it["heading"], size, p["accent"], bold=True,
              anchor="b", spacing=1.0)
        _text(slide, x + 2.8, BODY_Y + 17, w - 5, 11, it["text"], 1.55, p["text"])


def _build_cards(slide, d, p):
    items = d.get("items") or []
    for i, ((x, w), it) in enumerate(zip(_cols(max(len(items), 1)), items)):
        _rect(slide, x, BODY_Y + 1, w, 30, p["surface"], radius=1.2)
        _oval(slide, x + 2.6, BODY_Y + 3.6, 4.2, p["accent"])
        _text(slide, x + 2.6, BODY_Y + 3.6, 4.2, 4.2, f"{i + 1}", 1.6, p["on_accent"], bold=True,
              align="c", anchor="m")
        _text(slide, x + 2.6, BODY_Y + 10.5, w - 5.2, 5, it["heading"], 1.9, p["text"], bold=True,
              spacing=1.05)
        _text(slide, x + 2.6, BODY_Y + 16.5, w - 5.2, 13, it["text"], 1.45, p["muted"])


def _build_process(slide, d, p):
    items = d.get("items") or []
    cols = _cols(max(len(items), 1))
    d_ = 5.2
    cy = BODY_Y + 4
    if len(cols) > 1:
        x0 = cols[0][0] + d_ / 2
        x1 = cols[-1][0] + d_ / 2
        _rect(slide, x0, cy + d_ / 2 - 0.12, x1 - x0, 0.24, p["rule"])
    for i, ((x, w), it) in enumerate(zip(cols, items)):
        _oval(slide, x, cy, d_, p["accent"])
        _text(slide, x, cy, d_, d_, f"{i + 1}", 2.0, p["on_accent"], bold=True, align="c", anchor="m")
        _text(slide, x, cy + 8, w - 1, 5, it["heading"], 1.9, p["text"], bold=True, spacing=1.05)
        _text(slide, x, cy + 13.5, w - 1, 14, it["text"], 1.45, p["muted"])


def _build_comparison(slide, d, p):
    cols = (d.get("columns") or [])[:2]
    for i, ((x, w), c) in enumerate(zip(_cols(2, gap=3), cols)):
        top_fill = p["accent"] if i == 0 else p["text"]
        _rect(slide, x, BODY_Y + 1, w, 31, p["surface"], radius=1.2)
        _rect(slide, x, BODY_Y + 1, w, 0.6, top_fill)
        _text(slide, x + 3, BODY_Y + 3.6, w - 6, 4, c.get("heading", ""), 2.1,
              p["accent"] if i == 0 else p["text"], bold=True)
        pts = c.get("points") or []
        row = min(5.6, 22 / max(len(pts), 1))
        for j, pt in enumerate(pts):
            y = BODY_Y + 9.5 + j * row
            _rect(slide, x + 3, y + 0.75, 0.7, 0.7, top_fill)
            _text(slide, x + 5.2, y, w - 8.2, row, pt, 1.55, p["text"])


def _build_quote(slide, d, p):
    _text(slide, MX, BODY_Y - 3, 12, 12, "“", 14, p["accent"], bold=True, spacing=1.0)
    _text(slide, MX + 8, BODY_Y + 2, 78, 22, d.get("quote", ""), 2.9, p["text"], italic=True, spacing=1.2)
    if d.get("attribution"):
        _rect(slide, MX + 8, BODY_Y + 26, 3, 0.3, p["accent"])
        _text(slide, MX + 12.5, BODY_Y + 25.1, 70, 3, d["attribution"], 1.45, p["muted"], bold=True)


def build_pptx(
    slides_data: list[dict],
    doc_title: str = "Document",
    theme: dict | None = None,
    author: str | None = None,
) -> bytes:
    theme = theme or {}
    preset = theme.get("preset", "classic")
    if preset not in _PRESETS:
        preset = "classic"
    p = palette(preset, _hex(theme.get("accent")))
    author = (author or "").strip()

    prs = Presentation()
    prs.slide_width = Inches(_SLIDE_W_IN)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]  # completely blank

    # Footer shows the cover's title (a real name) rather than the uploaded filename.
    cover = next((s for s in slides_data if isinstance(s, dict) and s.get("type") == "title" and s.get("title")), None)
    footer = _s(cover["title"]) if cover else doc_title

    section_no = 0
    for idx, raw in enumerate(slides_data):
        d = _normalize_slide(raw) or {"type": "content", "title": ""}
        slide = prs.slides.add_slide(blank_layout)
        kind = d["type"]
        if kind == "title":
            _build_title(slide, d, p, preset, author)
        elif kind == "section":
            section_no += 1
            _build_section(slide, d, p, preset, section_no)
        elif kind == "closing":
            _build_closing(slide, d, p, preset, author)
        else:
            _chrome(slide, p, d.get("title", "") if kind != "quote" else "", footer, idx + 1)
            {
                "content": _build_content, "agenda": _build_agenda, "stats": _build_stats,
                "cards": _build_cards, "process": _build_process,
                "comparison": _build_comparison, "quote": _build_quote,
            }[kind](slide, d, p)

        note = d.get("speaker_note", "")
        if note:
            slide.notes_slide.notes_text_frame.text = note

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


async def generate_presentation(documents: list[DocumentData], plan: str = "free") -> bytes:
    slides_data = await generate_slides_data(documents, plan)
    doc_title = documents[0].filename.rsplit(".", 1)[0] if documents else "Document"
    return build_pptx(slides_data, doc_title)
