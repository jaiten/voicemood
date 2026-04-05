# VoiceMood

VoiceMood is now a calm, voice-first journaling app built with Expo + TypeScript on the frontend and FastAPI + Python on the backend.

It supports:

- importing existing voice memos
- recording new voice notes in the app
- writing text notes in the app
- transcribing audio with `faster-whisper`
- analyzing transcript sentiment and acoustic tone locally
- generating short topic-style summaries
- saving entries locally with SQLite
- browsing entries in `History` and `Timeline`

## Project structure

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

## How it works

### Audio entries

For imported or recorded audio:

1. The Expo app uploads the audio file to `POST /analyze`.
2. The FastAPI backend saves the upload temporarily.
3. `faster-whisper` transcribes the file locally.
4. Transcript sentiment is scored with:
   - VADER
   - keyword adjustment
5. Acoustic analysis extracts local audio features such as:
   - pitch mean / median / variation
   - RMS energy and variability
   - intensity
   - pause ratio
   - voiced ratio
   - speaking rate estimate
   - spectral centroid
   - zero-crossing rate
6. A simple tone heuristic labels the voice as:
   - `Calm`
   - `Animated`
   - `Flat`
   - `Tense`
   - `Subdued`
7. The backend combines scores using:
   - `55%` transcript sentiment
   - `35%` acoustic tone
   - `10%` keyword balance
8. The backend generates a short summary:
   - via OpenRouter if `OPENROUTER_API_KEY` is configured
   - otherwise via a local fallback
9. The frontend saves the finished journal entry locally in SQLite.

### Text entries

For written notes:

1. The Expo app sends the note body to `POST /analyze-text`.
2. The backend analyzes the text sentiment locally.
3. OpenRouter or the local fallback generates a short caption-like summary.
4. The app saves the result as a first-class journal entry.

## Journal model

VoiceMood now stores a unified local journal entry model instead of only imported memo analyses.

Each entry can be:

- `imported_audio`
- `recorded_audio`
- `text`

Important date behavior:

- the app keeps `sourceCreatedAt` or `sourceModifiedAt` when available from imported files
- `createdAt` is chosen from:
  1. source created date
  2. else source modified date
  3. else import/save time
- `History` and `Timeline` use that canonical `createdAt`

This means imported memos are grouped by their original memo date when that metadata is available.

## App screens

### Capture

The main capture area now has 3 modes:

- `Import`
- `Record`
- `Write`

Use it to:

- import one or many `.m4a`, `.mp3`, or `.wav` files
- record a new voice note in-app
- write and analyze a text note

### Results

Batch import results show:

- average happiness
- overall label
- transcript average
- tone average
- per-note result cards

### History

History shows the latest saved journal entries in reverse chronological order:

- grouped by day
- mixed entry types together
- entry type badge
- summary or title
- timestamp
- score and tone badge

### Timeline

Timeline supports:

- `Week` mode
- `Month` mode

It shows:

- entry-weighted period averages
- total entries
- day color based on average happiness
- selected day summary
- selected week average
- a tap-through list of entries for the selected day

### Detail

Entry detail shows:

- summary
- timeline date
- overall happiness
- text score
- tone score when available
- transcript or text body
- raw audio features for audio entries

## Run locally

You need both the backend and the frontend running.

### 1. Backend

```powershell
cd C:\Users\jaiten\Documents\Code\Voice\voicemood\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Quick health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```

### 2. Frontend

Open a second terminal:

```powershell
cd C:\Users\jaiten\Documents\Code\Voice\voicemood\frontend
npm install
Copy-Item .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `frontend/.env`.

Use your computer's LAN IP if you are testing on a real iPhone:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Do not use `localhost` on the phone.

Start Expo:

```powershell
npx expo start -c
```

## Environment variables

### Backend

`backend/.env` supports:

```env
APP_NAME=VoiceMood API
APP_ENV=development
BACKEND_CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
WHISPER_MODEL_SIZE=base.en
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_LANGUAGE=en
WHISPER_BEAM_SIZE=1
WHISPER_VAD_FILTER=true
ACOUSTIC_SAMPLE_RATE=16000
MODEL_CACHE_DIR=.cache/models
OPENROUTER_API_KEY=
```

Notes:

- `WHISPER_MODEL_SIZE=base.en` is the current default.
- if your machine is slow, switch to `tiny.en`
- if you want better local transcription later, try `small.en`
- `OPENROUTER_API_KEY` is optional; the app falls back to a local summary if it is missing

### Frontend

`frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

## Dependencies added for the journal app

Frontend now uses:

- `expo-document-picker`
- `expo-audio`
- `expo-file-system`
- `expo-sqlite`
- `react-native-reanimated`

Backend uses:

- `faster-whisper`
- `vaderSentiment`
- `numpy`
- `librosa`
- `requests`

## Local persistence

The frontend stores journal entries locally with `expo-sqlite`.

This powers:

- `History`
- `Timeline`
- day, week, and month aggregations

There is no cloud sync yet.

## Backend logs

The backend logs each major step:

- request started/completed
- batch started/completed
- file persisted
- transcription started/completed
- sentiment started/completed
- acoustic analysis started/completed
- summary started/completed
- OpenRouter request started/succeeded/failed

## Common issues

### `network timed out`

Usually means the frontend cannot reach the backend.

Check:

- the backend is running on port `8000`
- `frontend/.env` points to the correct IP and port
- the phone and computer are on the same Wi-Fi
- Windows Firewall is not blocking the backend

### OpenRouter summary says skipped

That means `OPENROUTER_API_KEY` is missing in `backend/.env`, or the backend was not restarted after adding it.

### Recording permission problems

If recording does not start:

- make sure microphone permission was granted on the phone
- restart Expo after dependency changes
- if you later make a development build, keep the `expo-audio` plugin config in `frontend/app.json`

### First request is slow

The first transcription request may download the Whisper model, which can take a while.

## Cheap/free deployment notes

- Keep the frontend local in Expo during development.
- Deploy the backend first if you want remote testing.
- A simple Docker-based FastAPI deploy is the easiest hobby path.
- A `render.yaml` file is included for a small Render deploy.
- If a free host is too slow for `base.en`, switch the host to `tiny.en`.
