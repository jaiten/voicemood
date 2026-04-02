# VoiceMood

Simple hobby MVP for importing Apple Voice Memos, uploading them to a FastAPI backend, transcribing them with `faster-whisper`, and showing a lightweight happiness score in an Expo app.

## Folder structure

```text
voicemood/
  backend/
    app/
    Dockerfile
    requirements.txt
  frontend/
    src/
    App.tsx
    package.json
```

## Backend setup

1. Create a virtual environment:

   ```powershell
   cd voicemood\backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Copy the example env file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Start the API:

   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. Check health:

   ```powershell
   curl http://127.0.0.1:8000/health
   ```

Notes:

- The first transcription request downloads the Whisper model automatically.
- `tiny.en` is the default because it is much lighter for hobby hosting.
- If you want better English transcripts later, try `WHISPER_MODEL_SIZE=base.en`.

## Frontend setup

1. Install dependencies:

   ```powershell
   cd ..\frontend
   npm install
   ```

2. Create the frontend env file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set `EXPO_PUBLIC_API_URL` in `frontend/.env`.

   Use your computer's LAN IP for a real iPhone on the same Wi-Fi, for example:

   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
   ```

   Do not use `localhost` if the app is running on your phone.

4. Start Expo:

   ```powershell
   npm run start
   ```

## How the MVP works

- Import one or more `.m4a`, `.mp3`, or `.wav` files with `expo-document-picker`
- Upload them as multipart form data to `POST /analyze`
- Transcribe each note with `faster-whisper`
- Score each transcript with:
  - 80% VADER sentiment score
  - 20% keyword-based adjustment
- Return per-note results plus an average happiness score
- Keep batch processing resilient so one failed file does not fail the whole request

## API response shape

```json
{
  "average_happiness": 72,
  "overall_label": "High",
  "count": 2,
  "successful_count": 2,
  "failed_count": 0,
  "results": [
    {
      "filename": "memo1.m4a",
      "status": "success",
      "transcript": "Today was actually pretty good...",
      "happiness_score": 78,
      "label": "High",
      "summary": "Mostly positive and reflective.",
      "error": null
    }
  ]
}
```

## Cheap/free deployment notes

- Keep the frontend local in Expo during development and deploy only the backend first.
- The simplest hobby path is a small Docker-based FastAPI deploy.
- A ready-to-edit `render.yaml` is included for a free Render web service.
- Use `tiny.en` on free tiers because larger Whisper models are slower and heavier.
- If your host has an ephemeral filesystem, the model cache can disappear between restarts and the first request after a restart will be slow.
- If you outgrow free tiers, the next step is a very small paid instance with persistent disk or always-on storage.

### Render quick start

1. Push `voicemood/` to GitHub.
2. In Render, create a new Blueprint or Web Service.
3. Point it at this repo and keep the included `render.yaml`, or use:

   - Root directory: `voicemood`
   - Dockerfile path: `backend/Dockerfile`

4. Keep the default `tiny.en` settings for the first deploy.
5. After deploy, copy the public backend URL into `frontend/.env` as `EXPO_PUBLIC_API_URL`.
