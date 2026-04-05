import re
from typing import Any

import librosa
import numpy as np
from faster_whisper.audio import decode_audio

from .config import settings
from .sentiment import clamp_score


FRAME_LENGTH = 2048
HOP_LENGTH = 512
MIN_RMS_ACTIVITY_THRESHOLD = 0.008
PITCH_FMIN = librosa.note_to_hz("C2")
PITCH_FMAX = librosa.note_to_hz("C7")

TONE_BASE_SCORES = {
    "Animated": 74,
    "Calm": 63,
    "Flat": 42,
    "Tense": 36,
    "Subdued": 28,
}

WORD_PATTERN = re.compile(r"\b[\w']+\b")


def _round_optional(value: float | None, digits: int) -> float | None:
    if value is None:
        return None

    numeric_value = float(value)
    if np.isnan(numeric_value) or np.isinf(numeric_value):
        return None

    return float(round(numeric_value, digits))


def _build_activity_mask(rms: np.ndarray) -> np.ndarray:
    if rms.size == 0:
        return np.array([], dtype=bool)

    non_silent = rms[rms > 0]
    baseline = np.percentile(non_silent, 30) if non_silent.size else 0.0
    threshold = max(MIN_RMS_ACTIVITY_THRESHOLD, baseline * 0.85)
    return rms > threshold


def _pitch_features(y: np.ndarray, sr: int) -> dict[str, float | None]:
    try:
        f0, _, _ = librosa.pyin(
            y,
            fmin=PITCH_FMIN,
            fmax=PITCH_FMAX,
            sr=sr,
            frame_length=FRAME_LENGTH,
            hop_length=HOP_LENGTH,
        )
    except Exception:
        return {
            "pitch_mean": None,
            "pitch_median": None,
            "pitch_std": None,
            "voiced_ratio": None,
        }

    if f0 is None:
        return {
            "pitch_mean": None,
            "pitch_median": None,
            "pitch_std": None,
            "voiced_ratio": None,
        }

    voiced_f0 = f0[np.isfinite(f0)]
    voiced_ratio = float(np.mean(np.isfinite(f0))) if f0.size else None

    if voiced_f0.size == 0:
        return {
            "pitch_mean": None,
            "pitch_median": None,
            "pitch_std": None,
            "voiced_ratio": _round_optional(voiced_ratio, 4),
        }

    return {
        "pitch_mean": _round_optional(float(np.mean(voiced_f0)), 1),
        "pitch_median": _round_optional(float(np.median(voiced_f0)), 1),
        "pitch_std": _round_optional(float(np.std(voiced_f0)), 1),
        "voiced_ratio": _round_optional(voiced_ratio, 4),
    }


def _estimate_speaking_rate(
    transcript: str | None,
    active_speech_seconds: float,
    duration_seconds: float,
) -> float | None:
    if not transcript:
        return None

    word_count = len(WORD_PATTERN.findall(transcript))
    if word_count == 0:
        return None

    denominator = active_speech_seconds if active_speech_seconds >= 0.75 else duration_seconds
    if denominator <= 0:
        return None

    # This is a transcript-assisted estimate of words per second during active speech.
    return _round_optional(min(6.0, word_count / denominator), 2)


def _classify_tone(features: dict[str, float | None]) -> str | None:
    rms_mean = features.get("rms_mean")
    rms_std = features.get("rms_std")
    pause_ratio = features.get("pause_ratio")
    pitch_std = features.get("pitch_std")
    speaking_rate = features.get("speaking_rate_estimate")
    voiced_ratio = features.get("voiced_ratio")

    if rms_mean is None or pause_ratio is None:
        return None

    low_energy = rms_mean < 0.018
    soft_energy = rms_mean < 0.028
    high_energy = rms_mean > 0.045
    low_variability = rms_std is not None and rms_std < 0.012
    high_variability = rms_std is not None and rms_std > 0.024
    narrow_pitch = pitch_std is not None and pitch_std < 18
    wide_pitch = pitch_std is not None and pitch_std > 42
    slow_rate = speaking_rate is not None and speaking_rate < 2.0
    fast_rate = speaking_rate is not None and speaking_rate > 3.2
    many_pauses = pause_ratio > 0.28
    some_pauses = pause_ratio > 0.22
    few_pauses = pause_ratio < 0.16
    low_voicing = voiced_ratio is not None and voiced_ratio < 0.45

    if low_energy and (slow_rate or many_pauses or narrow_pitch or low_voicing):
        return "Subdued"

    if high_energy and (wide_pitch or high_variability) and (fast_rate or few_pauses):
        return "Animated"

    if soft_energy and low_variability and (narrow_pitch or low_voicing):
        return "Flat"

    if (high_variability or wide_pitch) and (some_pauses or fast_rate or high_energy):
        return "Tense"

    return "Calm"


def _score_tone(features: dict[str, float | None], tone_label: str | None) -> int:
    if not tone_label:
        return 50

    score = TONE_BASE_SCORES[tone_label]
    pause_ratio = features.get("pause_ratio")
    speaking_rate = features.get("speaking_rate_estimate")
    rms_mean = features.get("rms_mean")
    voiced_ratio = features.get("voiced_ratio")

    if pause_ratio is not None:
        if pause_ratio < 0.14:
            score += 3
        elif pause_ratio > 0.32:
            score -= 6

    if speaking_rate is not None:
        if 2.2 <= speaking_rate <= 3.6 and tone_label in {"Calm", "Animated"}:
            score += 2
        elif speaking_rate < 1.7:
            score -= 4

    if rms_mean is not None:
        if rms_mean > 0.055 and tone_label == "Animated":
            score += 3
        elif rms_mean < 0.016:
            score -= 4

    if voiced_ratio is not None and voiced_ratio < 0.4:
        score -= 3

    return clamp_score(score)


def neutral_acoustic_result() -> dict[str, Any]:
    return {
        "acoustic_tone_score": 50,
        "tone_label": None,
        "audio_features": None,
    }


def analyze_acoustic_tone(file_path: str, transcript: str | None = None) -> dict[str, Any]:
    audio = decode_audio(file_path, sampling_rate=settings.acoustic_sample_rate)
    y = np.asarray(audio, dtype=np.float32)

    if y.size == 0:
        return neutral_acoustic_result()

    duration_seconds = len(y) / settings.acoustic_sample_rate

    rms = librosa.feature.rms(y=y, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    activity_mask = _build_activity_mask(rms)
    active_speech_seconds = float(np.sum(activity_mask) * HOP_LENGTH / settings.acoustic_sample_rate)
    pause_ratio = float(np.mean(~activity_mask)) if activity_mask.size else 0.0

    pitch_features = _pitch_features(y, settings.acoustic_sample_rate)
    spectral_centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=settings.acoustic_sample_rate,
        n_fft=FRAME_LENGTH,
        hop_length=HOP_LENGTH,
    )[0]
    zero_crossing_rate = librosa.feature.zero_crossing_rate(
        y,
        frame_length=FRAME_LENGTH,
        hop_length=HOP_LENGTH,
    )[0]

    intensity_db = librosa.amplitude_to_db(np.maximum(rms, 1e-6), ref=1.0)
    focus_mask = activity_mask if activity_mask.any() else np.ones_like(rms, dtype=bool)

    features = {
        "duration_seconds": _round_optional(duration_seconds, 2),
        "active_speech_seconds": _round_optional(active_speech_seconds, 2),
        "voiced_ratio": pitch_features["voiced_ratio"],
        "pause_ratio": _round_optional(pause_ratio, 4),
        "pitch_mean": pitch_features["pitch_mean"],
        "pitch_median": pitch_features["pitch_median"],
        "pitch_std": pitch_features["pitch_std"],
        "rms_mean": _round_optional(float(np.mean(rms[focus_mask])), 4),
        "rms_std": _round_optional(float(np.std(rms[focus_mask])), 4),
        "intensity_db_mean": _round_optional(float(np.mean(intensity_db[focus_mask])), 1),
        "speaking_rate_estimate": _estimate_speaking_rate(transcript, active_speech_seconds, duration_seconds),
        "spectral_centroid_mean": _round_optional(float(np.mean(spectral_centroid[focus_mask])), 1),
        "zero_crossing_rate_mean": _round_optional(float(np.mean(zero_crossing_rate[focus_mask])), 4),
    }

    tone_label = _classify_tone(features)
    acoustic_tone_score = _score_tone(features, tone_label)

    return {
        "acoustic_tone_score": acoustic_tone_score,
        "tone_label": tone_label,
        "audio_features": features,
    }
