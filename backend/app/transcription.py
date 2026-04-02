from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel

from .config import settings


@lru_cache
def get_model() -> WhisperModel:
    cache_dir = Path(settings.model_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    return WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        download_root=str(cache_dir),
    )


def transcribe_audio(file_path: str) -> str:
    model = get_model()
    segments, _ = model.transcribe(
        file_path,
        beam_size=settings.whisper_beam_size,
        language=settings.whisper_language,
        vad_filter=settings.whisper_vad_filter,
        condition_on_previous_text=False,
    )

    transcript_parts: list[str] = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            transcript_parts.append(text)

    return " ".join(transcript_parts).strip()

