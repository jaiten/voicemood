import json
import logging
import re

import requests

from .config import settings


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "qwen/qwen3.6-plus:free"
logger = logging.getLogger("uvicorn.error")
SUMMARY_PROMPT_TEMPLATE = """You are summarizing a personal voice memo transcript.

Write exactly ONE short, natural caption-like sentence that captures the main topic or event.

Rules:
- No clinical or psychological claims
- No exaggeration
- Do not infer beyond the transcript
- Keep it under 15 words
- Use simple, natural language
- Focus on what happened or what was discussed
- Do not say "the speaker", "they", "the person", "he", or "she"
- Avoid awkward third-person narration

Return ONLY valid JSON:
{"summary": "..."}

Transcript:
\"\"\"
{{TRANSCRIPT}}
\"\"\""""

BANNED_PREFIXES = (
    "the speaker",
    "they",
    "the person",
    "he",
    "she",
)

BANNED_SUMMARY_PATTERNS = [
    re.compile(r"^(the speaker|the person)\s+(talked about|discussed|mentioned|shared|described|reflected on)\s+", re.I),
    re.compile(r"^(they|he|she)\s+(talked about|discussed|mentioned|shared|described|reflected on|enjoyed|went|felt)\s+", re.I),
]


def _fallback_summary(transcript: str) -> str:
    cleaned = re.sub(r"\s+", " ", transcript.strip())
    if not cleaned:
        return "No transcript available."

    sentence = re.split(r"(?<=[.!?])\s+", cleaned, maxsplit=1)[0].strip(" .")
    words = sentence.split()
    if not words:
        return "Journal note"

    short_text = " ".join(words[:14]).strip(" ,.")
    return short_text or "Journal note"


def _normalize_summary(summary: str) -> str:
    cleaned = re.sub(r"\s+", " ", summary).strip().strip('"').strip("'")
    if not cleaned:
        return cleaned

    for pattern in BANNED_SUMMARY_PATTERNS:
        cleaned = pattern.sub("", cleaned).strip()

    if any(cleaned.lower().startswith(prefix) for prefix in BANNED_PREFIXES):
        return ""

    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]

    return cleaned.rstrip(".")


def build_summary(transcript: str) -> str:
    cleaned_transcript = transcript.strip()
    if not cleaned_transcript:
        return _fallback_summary(cleaned_transcript)

    if not settings.openrouter_api_key:
        logger.info("OpenRouter summary skipped: OPENROUTER_API_KEY not configured. Using fallback summary.")
        return _fallback_summary(cleaned_transcript)

    prompt = SUMMARY_PROMPT_TEMPLATE.replace("{{TRANSCRIPT}}", cleaned_transcript)
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    try:
        # This is synchronous for now to keep the pipeline simple. It can move to async later.
        logger.info(
            "OpenRouter summary request started. model=%s transcript_chars=%s",
            OPENROUTER_MODEL,
            len(cleaned_transcript),
        )
        response = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=20)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        summary = json.loads(content)["summary"]

        if not isinstance(summary, str):
            raise ValueError("Summary content was not a string.")

        normalized_summary = _normalize_summary(summary)
        if not normalized_summary:
            raise ValueError("Summary content was empty after cleanup.")

        logger.info(
            "OpenRouter summary succeeded. model=%s status_code=%s summary_chars=%s",
            OPENROUTER_MODEL,
            response.status_code,
            len(normalized_summary),
        )
        return normalized_summary
    except Exception as exc:
        logger.warning(
            "OpenRouter summary failed. model=%s error=%s Using fallback summary.",
            OPENROUTER_MODEL,
            exc,
        )
        return _fallback_summary(cleaned_transcript)
