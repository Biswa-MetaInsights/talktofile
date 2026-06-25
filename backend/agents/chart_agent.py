"""
Chart Agent — generates chart-ready JSON from Excel/CSV tabular data.
Uses GPT-4o to interpret the spreadsheet and map it to the requested chart type.
"""

import json
from openai import AsyncOpenAI
from core.session_store import DocumentData
from core.config import get_settings

CHART_TYPES = {"bar", "line", "area", "pie", "scatter"}

_SYSTEM = """You are a data visualisation expert. You receive tabular data extracted from a spreadsheet
and a requested chart type. Your job:

1. Identify the most meaningful columns/rows for the requested chart.
2. Pick a clear, descriptive chart title based on the data.
3. Return ONLY a JSON object (no markdown, no extra text) in this exact shape:

For bar / line / area charts:
{
  "chart_type": "bar",
  "title": "...",
  "x_label": "...",
  "y_label": "...",
  "labels": ["A", "B", "C"],
  "series": [
    {"name": "Series 1", "data": [1.0, 2.0, 3.0]},
    {"name": "Series 2", "data": [4.0, 5.0, 6.0]}
  ]
}

For pie charts:
{
  "chart_type": "pie",
  "title": "...",
  "x_label": "",
  "y_label": "",
  "labels": ["Slice A", "Slice B"],
  "series": [{"name": "Value", "data": [30.0, 70.0]}]
}

For scatter charts:
{
  "chart_type": "scatter",
  "title": "...",
  "x_label": "...",
  "y_label": "...",
  "labels": [],
  "series": [
    {"name": "Series 1", "data": [[1.0, 2.0], [3.0, 4.0]]}
  ]
}

Rules:
- Use ONLY data present in the spreadsheet — do not invent values.
- All numeric values must be plain numbers (not strings).
- Limit to at most 30 data points per series for readability.
- If the data does not suit the requested chart type, adapt gracefully to the closest sensible chart."""


async def generate_chart(documents: list[DocumentData], chart_type: str) -> dict:
    if chart_type not in CHART_TYPES:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    tabular_docs = [d for d in documents if d.is_tabular]
    if not tabular_docs:
        raise ValueError("No Excel or CSV data found in this session. Please upload an Excel or CSV file.")

    doc = tabular_docs[0]
    raw = (doc.raw_text or "").strip()
    if not raw:
        raise ValueError("The spreadsheet appears to be empty or could not be read.")

    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": (
                f"Spreadsheet data from '{doc.filename}':\n\n{raw[:10000]}\n\n"
                f"Requested chart type: {chart_type}"
            )},
        ],
        temperature=0.2,
        max_tokens=2000,
    )

    raw_json = (response.choices[0].message.content or "{}").strip()
    if raw_json.startswith("```"):
        raw_json = raw_json.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw_json)
    except json.JSONDecodeError:
        raise ValueError("Failed to parse chart data from the model response.")

    if not isinstance(result, dict) or "series" not in result:
        raise ValueError("Unexpected chart data structure returned.")

    return result
