import logging
from time import perf_counter
from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel

from .config import settings


logger = logging.getLogger("uvicorn.error")


@lru_cache
def get_model() -> WhisperModel:
    cache_dir = Path(settings.model_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    logger.info(
        "Loading Whisper model. model=%s device=%s compute_type=%s cache_dir=%s",
        settings.whisper_model_size,
        settings.whisper_device,
        settings.whisper_compute_type,
        cache_dir,
    )
    model = WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        download_root=str(cache_dir),
    )
    logger.info("Whisper model ready. model=%s", settings.whisper_model_size)
    return model


def transcribe_audio(file_path: str) -> str:
    started_at = perf_counter()
    model = get_model()
    logger.info("Whisper transcription started. file_path=%s", file_path)
    segments, _ = model.transcribe(
        file_path,
        beam_size=settings.whisper_beam_size,
        language=settings.whisper_language,
        vad_filter=settings.whisper_vad_filter,
        condition_on_previous_text=False,
    )

    transcript_parts: list[str] = []
    segment_count = 0
    for segment in segments:
        text = segment.text.strip()
        if text:
            segment_count += 1
            transcript_parts.append(text)

    transcript = " ".join(transcript_parts).strip()
    logger.info(
        "Whisper transcription completed. file_path=%s segment_count=%s transcript_chars=%s duration_ms=%.1f",
        file_path,
        segment_count,
        len(transcript),
        (perf_counter() - started_at) * 1000,
    )
    return transcript
