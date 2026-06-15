"""
Lingua Agent — detects the document language and translates to English if needed.
"""

from openai import AsyncOpenAI
from core.config import get_settings

try:
    from langdetect import detect, LangDetectException
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False


LANGUAGE_NAMES = {
    "af": "Afrikaans", "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali",
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "en": "English", "es": "Spanish", "et": "Estonian", "fa": "Persian",
    "fi": "Finnish", "fr": "French", "gu": "Gujarati", "he": "Hebrew",
    "hi": "Hindi", "hr": "Croatian", "hu": "Hungarian", "id": "Indonesian",
    "it": "Italian", "ja": "Japanese", "kn": "Kannada", "ko": "Korean",
    "lt": "Lithuanian", "lv": "Latvian", "mk": "Macedonian", "ml": "Malayalam",
    "mr": "Marathi", "nl": "Dutch", "no": "Norwegian", "pa": "Punjabi",
    "pl": "Polish", "pt": "Portuguese", "ro": "Romanian", "ru": "Russian",
    "sk": "Slovak", "sl": "Slovenian", "sq": "Albanian", "sr": "Serbian",
    "sv": "Swedish", "sw": "Swahili", "ta": "Tamil", "te": "Telugu",
    "th": "Thai", "tl": "Filipino", "tr": "Turkish", "uk": "Ukrainian",
    "ur": "Urdu", "vi": "Vietnamese", "zh-cn": "Chinese (Simplified)",
    "zh-tw": "Chinese (Traditional)",
}


def detect_language(text: str) -> str:
    sample = text[:2000]
    if LANGDETECT_AVAILABLE:
        try:
            return detect(sample)
        except Exception:
            pass
    return "en"


async def translate_to_english(text: str, source_lang: str) -> str:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    lang_name = LANGUAGE_NAMES.get(source_lang, source_lang.upper())

    # Translate in chunks to handle large documents
    chunk_size = 3000
    words = text.split()
    chunks = []
    current = []
    current_len = 0

    for word in words:
        current.append(word)
        current_len += len(word) + 1
        if current_len >= chunk_size:
            chunks.append(" ".join(current))
            current = []
            current_len = 0
    if current:
        chunks.append(" ".join(current))

    translated_chunks = []
    for chunk in chunks:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a professional translator. Translate the following {lang_name} text "
                        "to English. Preserve structure, formatting, and meaning exactly. "
                        "Output only the translated text, nothing else."
                    ),
                },
                {"role": "user", "content": chunk},
            ],
            temperature=0.1,
        )
        translated_chunks.append(resp.choices[0].message.content.strip())

    return "\n".join(translated_chunks)


async def detect_only(raw_text: str) -> tuple[str, bool]:
    """
    Returns: (detected_language_code, is_english)
    Document is NOT translated — GPT-4o understands any language natively.
    """
    lang = detect_language(raw_text)
    is_english = lang == "en" or lang.startswith("en")
    return lang, is_english
