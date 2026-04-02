import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    app_name: str = os.getenv("APP_NAME", "VoiceMood API")
    app_env: str = os.getenv("APP_ENV", "development")
    cors_origins: list[str] = _parse_csv(os.getenv("BACKEND_CORS_ORIGINS"))

    whisper_model_size: str = os.getenv("WHISPER_MODEL_SIZE", "base.en")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_language: str | None = os.getenv("WHISPER_LANGUAGE", "en") or None
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "1"))
    whisper_vad_filter: bool = _parse_bool(os.getenv("WHISPER_VAD_FILTER"), True)
    acoustic_sample_rate: int = int(os.getenv("ACOUSTIC_SAMPLE_RATE", "16000"))
    model_cache_dir: str = os.getenv("MODEL_CACHE_DIR", str(BASE_DIR / ".cache" / "models"))


settings = Settings()
