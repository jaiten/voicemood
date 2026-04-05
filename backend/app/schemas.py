from typing import Literal

from pydantic import BaseModel, Field


MoodLabel = Literal["Low", "Neutral", "High"]
ToneLabel = Literal["Calm", "Animated", "Flat", "Tense", "Subdued"]


class AudioFeatures(BaseModel):
    duration_seconds: float | None = Field(default=None, ge=0)
    active_speech_seconds: float | None = Field(default=None, ge=0)
    voiced_ratio: float | None = Field(default=None, ge=0, le=1)
    pause_ratio: float | None = Field(default=None, ge=0, le=1)
    pitch_mean: float | None = Field(default=None, ge=0)
    pitch_median: float | None = Field(default=None, ge=0)
    pitch_std: float | None = Field(default=None, ge=0)
    rms_mean: float | None = Field(default=None, ge=0)
    rms_std: float | None = Field(default=None, ge=0)
    intensity_db_mean: float | None = None
    speaking_rate_estimate: float | None = Field(default=None, ge=0)
    spectral_centroid_mean: float | None = Field(default=None, ge=0)
    zero_crossing_rate_mean: float | None = Field(default=None, ge=0, le=1)


class NoteAnalysisResult(BaseModel):
    filename: str
    status: Literal["success", "error"] = "success"
    transcript: str | None = None
    transcript_sentiment_score: int | None = Field(default=None, ge=0, le=100)
    transcript_label: MoodLabel | None = None
    keyword_adjustment_score: int | None = Field(default=None, ge=-50, le=50)
    acoustic_tone_score: int | None = Field(default=None, ge=0, le=100)
    overall_happiness_score: int | None = Field(default=None, ge=0, le=100)
    label: MoodLabel | None = None
    tone_label: ToneLabel | None = None
    summary: str | None = Field(default=None, description="Short one-sentence transcript summary.")
    audio_features: AudioFeatures | None = None
    error: str | None = None


class AnalyzeResponse(BaseModel):
    average_happiness: int = Field(ge=0, le=100)
    overall_label: MoodLabel
    count: int = Field(ge=0)
    successful_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    results: list[NoteAnalysisResult]


class AnalyzeTextRequest(BaseModel):
    text: str = Field(min_length=1)
    title: str | None = None


class HealthResponse(BaseModel):
    status: str
    model_size: str
    device: str
