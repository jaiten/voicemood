import logging
from time import perf_counter
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import unquote_plus
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .acoustic_analysis import analyze_acoustic_tone, neutral_acoustic_result
from .config import settings
from .schemas import AnalyzeResponse, AnalyzeTextRequest, HealthResponse, NoteAnalysisResult
from .sentiment import analyze_transcript, combine_scores, combine_text_only_scores, label_for_score
from .summary import build_summary
from .transcription import transcribe_audio


ALLOWED_EXTENSIONS = {".m4a", ".mp3", ".wav"}
logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Simple audio transcription and mood summary API for VoiceMood.",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    request_id = uuid4().hex[:8]
    request.state.request_id = request_id
    started_at = perf_counter()
    client_host = request.client.host if request.client else "unknown"

    logger.info(
        "HTTP request started. request_id=%s method=%s path=%s client=%s",
        request_id,
        request.method,
        request.url.path,
        client_host,
    )

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (perf_counter() - started_at) * 1000
        logger.exception(
            "HTTP request failed. request_id=%s method=%s path=%s duration_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "HTTP request completed. request_id=%s method=%s path=%s status_code=%s duration_ms=%.1f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_size=settings.whisper_model_size,
        device=settings.whisper_device,
    )


def _validate_extension(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix or 'unknown'}")
    return suffix


def _display_filename(filename: str) -> str:
    normalized = unquote_plus(filename.strip())
    return normalized or "untitled-audio"


async def _persist_upload(upload_file: UploadFile) -> tuple[str, int]:
    suffix = _validate_extension(upload_file.filename or "")
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await upload_file.read()
        temp_file.write(content)
        return temp_file.name, len(content)


def _build_text_note_result(
    title: str,
    text: str,
    summary: str,
    text_analysis: dict[str, str | int | float],
) -> NoteAnalysisResult:
    overall_happiness_score = combine_text_only_scores(
        int(text_analysis["transcript_sentiment_score"]),
        int(text_analysis["keyword_balance_score"]),
    )
    overall_label = label_for_score(overall_happiness_score)

    return NoteAnalysisResult(
        filename=title,
        transcript=text,
        transcript_sentiment_score=int(text_analysis["transcript_sentiment_score"]),
        transcript_label=str(text_analysis["transcript_label"]),
        keyword_adjustment_score=int(text_analysis["keyword_adjustment_score"]),
        acoustic_tone_score=None,
        overall_happiness_score=overall_happiness_score,
        label=overall_label,
        tone_label=None,
        summary=summary,
        audio_features=None,
    )


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: Request, files: list[UploadFile] = File(...)) -> AnalyzeResponse:
    if not files:
        raise HTTPException(status_code=400, detail="At least one audio file is required.")

    request_id = getattr(request.state, "request_id", "unknown")
    batch_started_at = perf_counter()
    results: list[NoteAnalysisResult] = []
    successful_scores: list[int] = []

    logger.info(
        "Analyze batch started. request_id=%s file_count=%s",
        request_id,
        len(files),
    )

    for index, upload in enumerate(files, start=1):
        temp_path: str | None = None
        filename = _display_filename(upload.filename or "untitled-audio")
        file_started_at = perf_counter()

        try:
            logger.info(
                "File processing started. request_id=%s file_index=%s filename=%s",
                request_id,
                index,
                filename,
            )
            temp_path, byte_count = await _persist_upload(upload)
            logger.info(
                "Upload persisted. request_id=%s file_index=%s filename=%s bytes=%s temp_path=%s",
                request_id,
                index,
                filename,
                byte_count,
                temp_path,
            )

            logger.info(
                "Transcription step started. request_id=%s file_index=%s filename=%s",
                request_id,
                index,
                filename,
            )
            transcript = transcribe_audio(temp_path)
            logger.info(
                "Transcription step completed. request_id=%s file_index=%s filename=%s transcript_chars=%s",
                request_id,
                index,
                filename,
                len(transcript),
            )

            logger.info(
                "Text sentiment step started. request_id=%s file_index=%s filename=%s",
                request_id,
                index,
                filename,
            )
            text_analysis = analyze_transcript(transcript)
            logger.info(
                "Text sentiment step completed. request_id=%s file_index=%s filename=%s transcript_score=%s keyword_adjustment=%s",
                request_id,
                index,
                filename,
                text_analysis["transcript_sentiment_score"],
                text_analysis["keyword_adjustment_score"],
            )

            try:
                logger.info(
                    "Acoustic analysis step started. request_id=%s file_index=%s filename=%s",
                    request_id,
                    index,
                    filename,
                )
                acoustic_analysis = analyze_acoustic_tone(temp_path, transcript)
                logger.info(
                    "Acoustic analysis step completed. request_id=%s file_index=%s filename=%s tone_label=%s acoustic_score=%s",
                    request_id,
                    index,
                    filename,
                    acoustic_analysis["tone_label"],
                    acoustic_analysis["acoustic_tone_score"],
                )
            except Exception as exc:
                logger.warning(
                    "Acoustic analysis failed. request_id=%s file_index=%s filename=%s error=%s Using neutral fallback.",
                    request_id,
                    index,
                    filename,
                    exc,
                )
                acoustic_analysis = neutral_acoustic_result()

            logger.info(
                "Score combination step started. request_id=%s file_index=%s filename=%s",
                request_id,
                index,
                filename,
            )
            overall_happiness_score = combine_scores(
                int(text_analysis["transcript_sentiment_score"]),
                int(acoustic_analysis["acoustic_tone_score"]),
                int(text_analysis["keyword_balance_score"]),
            )
            overall_label = label_for_score(overall_happiness_score)
            logger.info(
                "Score combination step completed. request_id=%s file_index=%s filename=%s overall_score=%s overall_label=%s",
                request_id,
                index,
                filename,
                overall_happiness_score,
                overall_label,
            )

            logger.info(
                "Summary step started. request_id=%s file_index=%s filename=%s",
                request_id,
                index,
                filename,
            )
            summary = build_summary(transcript)
            logger.info(
                "Summary step completed. request_id=%s file_index=%s filename=%s summary_chars=%s",
                request_id,
                index,
                filename,
                len(summary),
            )

            result = NoteAnalysisResult(
                filename=filename,
                transcript=transcript,
                transcript_sentiment_score=int(text_analysis["transcript_sentiment_score"]),
                transcript_label=str(text_analysis["transcript_label"]),
                keyword_adjustment_score=int(text_analysis["keyword_adjustment_score"]),
                acoustic_tone_score=int(acoustic_analysis["acoustic_tone_score"]),
                overall_happiness_score=overall_happiness_score,
                label=overall_label,
                tone_label=acoustic_analysis["tone_label"],
                summary=summary,
                audio_features=acoustic_analysis["audio_features"],
            )
            results.append(result)
            successful_scores.append(result.overall_happiness_score or 0)
            logger.info(
                "File processing completed. request_id=%s file_index=%s filename=%s duration_ms=%.1f",
                request_id,
                index,
                filename,
                (perf_counter() - file_started_at) * 1000,
            )
        except ValueError as exc:
            logger.warning(
                "File validation failed. request_id=%s file_index=%s filename=%s error=%s",
                request_id,
                index,
                filename,
                exc,
            )
            results.append(
                NoteAnalysisResult(
                    filename=filename,
                    status="error",
                    error=str(exc),
                    summary="This file could not be analyzed.",
                )
            )
        except Exception as exc:  # pragma: no cover - keeps single file failures isolated
            logger.exception(
                "File processing failed. request_id=%s file_index=%s filename=%s error=%s",
                request_id,
                index,
                filename,
                exc,
            )
            results.append(
                NoteAnalysisResult(
                    filename=filename,
                    status="error",
                    error=str(exc),
                    summary="Analysis failed for this file, but the batch continued.",
                )
            )
        finally:
            await upload.close()
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)
                logger.info(
                    "Temporary file removed. request_id=%s file_index=%s filename=%s",
                    request_id,
                    index,
                    filename,
                )

    if successful_scores:
        average_happiness = int(round(sum(successful_scores) / len(successful_scores)))
    else:
        average_happiness = 50

    successful_count = len(successful_scores)
    failed_count = len(results) - successful_count

    logger.info(
        "Analyze batch completed. request_id=%s successful_count=%s failed_count=%s average_happiness=%s duration_ms=%.1f",
        request_id,
        successful_count,
        failed_count,
        average_happiness,
        (perf_counter() - batch_started_at) * 1000,
    )

    return AnalyzeResponse(
        average_happiness=average_happiness,
        overall_label=label_for_score(average_happiness),
        count=len(results),
        successful_count=successful_count,
        failed_count=failed_count,
        results=results,
    )


@app.post("/analyze-text", response_model=NoteAnalysisResult)
async def analyze_text(request: Request, payload: AnalyzeTextRequest) -> NoteAnalysisResult:
    request_id = getattr(request.state, "request_id", "unknown")
    started_at = perf_counter()
    title = payload.title.strip() if payload.title else "Text note"
    text = payload.text.strip()

    logger.info(
        "Text analysis started. request_id=%s title=%s text_chars=%s",
        request_id,
        title,
        len(text),
    )

    try:
        text_analysis = analyze_transcript(text)
        summary = build_summary(text)
        result = _build_text_note_result(title, text, summary, text_analysis)
        logger.info(
            "Text analysis completed. request_id=%s title=%s overall_score=%s duration_ms=%.1f",
            request_id,
            title,
            result.overall_happiness_score,
            (perf_counter() - started_at) * 1000,
        )
        return result
    except Exception as exc:  # pragma: no cover - keeps request logging explicit
        logger.exception(
            "Text analysis failed. request_id=%s title=%s error=%s duration_ms=%.1f",
            request_id,
            title,
            exc,
            (perf_counter() - started_at) * 1000,
        )
        raise HTTPException(status_code=500, detail="The backend could not analyze this text note.") from exc
