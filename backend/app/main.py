from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas import AnalyzeResponse, HealthResponse, NoteAnalysisResult
from .sentiment import analyze_transcript, label_for_score
from .transcription import transcribe_audio


ALLOWED_EXTENSIONS = {".m4a", ".mp3", ".wav"}

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


async def _persist_upload(upload_file: UploadFile) -> str:
    suffix = _validate_extension(upload_file.filename or "")
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await upload_file.read()
        temp_file.write(content)
        return temp_file.name


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(files: list[UploadFile] = File(...)) -> AnalyzeResponse:
    if not files:
        raise HTTPException(status_code=400, detail="At least one audio file is required.")

    results: list[NoteAnalysisResult] = []
    successful_scores: list[int] = []

    for upload in files:
        temp_path: str | None = None
        filename = upload.filename or "untitled-audio"

        try:
            temp_path = await _persist_upload(upload)
            transcript = transcribe_audio(temp_path)
            sentiment = analyze_transcript(transcript)

            result = NoteAnalysisResult(
                filename=filename,
                transcript=transcript,
                happiness_score=int(sentiment["happiness_score"]),
                label=str(sentiment["label"]),
                summary=str(sentiment["summary"]),
            )
            results.append(result)
            successful_scores.append(result.happiness_score or 0)
        except ValueError as exc:
            results.append(
                NoteAnalysisResult(
                    filename=filename,
                    status="error",
                    error=str(exc),
                    summary="This file could not be analyzed.",
                )
            )
        except Exception as exc:  # pragma: no cover - keeps single file failures isolated
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

    if successful_scores:
        average_happiness = int(round(sum(successful_scores) / len(successful_scores)))
    else:
        average_happiness = 50

    successful_count = len(successful_scores)
    failed_count = len(results) - successful_count

    return AnalyzeResponse(
        average_happiness=average_happiness,
        overall_label=label_for_score(average_happiness),
        count=len(results),
        successful_count=successful_count,
        failed_count=failed_count,
        results=results,
    )
