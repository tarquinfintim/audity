# Docker & Infrastructure

## Container Architecture

```
docker-compose.yml
├── frontend   (Node 22 Alpine — Vite dev server / static build)
├── backend    (Python 3.13 Slim + FFmpeg — FastAPI)
└── caddy      (Reverse proxy — routes /api → backend, / → frontend)
```

All three services in a single `docker-compose.yml`. No local installs of Node, Python, uv, or any framework.

---

## Directory Structure

```
audity/
├── docker-compose.yml
├── docker-compose.prod.yml         # Production overrides
├── .env                            # Shared env vars (ports, etc.)
├── .env.example
│
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── MenuBar/
│       │   ├── Toolbar/
│       │   ├── WaveformEditor/
│       │   ├── WaveformOverview/
│       │   ├── TimeRuler/
│       │   ├── TransportBar/
│       │   ├── StatusBar/
│       │   ├── SidePanel/
│       │   └── EffectDialog/
│       ├── engine/                 # Audio engine (non-UI)
│       │   ├── audioContext.ts     # Singleton AudioContext manager
│       │   ├── playback.ts        # Playback controller
│       │   ├── decoder.ts         # File → AudioBuffer
│       │   ├── encoder.ts         # AudioBuffer → WAV blob
│       │   ├── effects/           # Effect processors
│       │   │   ├── gain.ts
│       │   │   ├── normalize.ts
│       │   │   ├── fade.ts
│       │   │   ├── filter.ts
│       │   │   ├── noiseReduce.ts
│       │   │   ├── compressor.ts
│       │   │   └── index.ts
│       │   └── waveform.ts        # Peak computation for rendering
│       ├── store/                  # Zustand stores
│       │   ├── editorStore.ts
│       │   ├── playbackStore.ts
│       │   └── uiStore.ts
│       ├── commands/               # Undo/redo command objects
│       │   ├── types.ts
│       │   ├── cutCommand.ts
│       │   ├── pasteCommand.ts
│       │   ├── deleteCommand.ts
│       │   ├── effectCommand.ts
│       │   └── history.ts
│       ├── hooks/                  # Custom React hooks
│       │   ├── useAudioEngine.ts
│       │   ├── useKeyboardShortcuts.ts
│       │   ├── useWaveformRenderer.ts
│       │   └── useFileSystem.ts
│       ├── lib/                    # Utilities
│       │   ├── fileSystemAccess.ts # FSAPI wrapper + fallback
│       │   ├── indexedDB.ts        # Recent files persistence
│       │   ├── formatTime.ts
│       │   └── constants.ts
│       └── styles/
│           └── globals.css         # Tailwind base + theme tokens
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml              # uv project config
│   ├── uv.lock
│   └── src/
│       └── audity_api/
│           ├── __init__.py
│           ├── main.py             # FastAPI app
│           ├── routes/
│           │   └── encode.py       # POST /api/encode
│           └── services/
│               └── converter.py    # pydub/FFmpeg wrapper
│
└── caddy/
    └── Caddyfile
```

---

## Docker Compose — Development

```yaml
# docker-compose.yml (dev mode)
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules        # Anonymous volume to preserve node_modules
    environment:
      - VITE_API_URL=/api
    command: npx vite --host 0.0.0.0

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - ENVIRONMENT=development
    command: uv run uvicorn audity_api.main:app --host 0.0.0.0 --port 8000 --reload

  caddy:
    image: caddy:2-alpine
    ports:
      - "3000:3000"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
    depends_on:
      - frontend
      - backend
```

### Access Points (Dev)
- **App (via proxy)**: `http://localhost:3000` — recommended, routes API correctly
- **Vite direct**: `http://localhost:5173` — for HMR debugging
- **API direct**: `http://localhost:8000` — for API testing

---

## Dockerfiles

### Frontend Dockerfile (Dev)

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]
```

### Frontend Dockerfile (Prod)

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
```

### Backend Dockerfile

```dockerfile
FROM python:3.13-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen

COPY . .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "audity_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Caddy Configuration

```
# caddy/Caddyfile
:3000 {
    handle /api/* {
        reverse_proxy backend:8000
    }

    handle {
        reverse_proxy frontend:5173
    }
}
```

Production Caddyfile would serve static files directly instead of proxying to Vite.

---

## Backend API Specification

### `POST /api/encode`

Convert audio from one format to another.

**Request**: `multipart/form-data`
- `file`: Audio file (WAV binary)
- `format`: Target format (`mp3`, `ogg`, `flac`)
- `bitrate`: (optional) Bitrate for lossy formats, e.g. `192k`. Default: `192k`
- `sample_rate`: (optional) Target sample rate. Default: preserve original

**Response**: Binary audio file with appropriate `Content-Type`
- `audio/mpeg` for MP3
- `audio/ogg` for OGG
- `audio/flac` for FLAC

**Error responses**:
- `400` — Invalid format or missing file
- `413` — File too large (limit: 500MB)
- `500` — FFmpeg conversion error

### `GET /api/health`

Health check endpoint.

**Response**: `{ "status": "ok", "ffmpeg": true }`

---

## Environment Variables

```env
# .env
COMPOSE_PROJECT_NAME=audity

# Frontend
VITE_API_URL=/api

# Backend
ENVIRONMENT=development
MAX_UPLOAD_SIZE_MB=500
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## Development Workflow

```bash
# Start everything (first time or after dependency changes)
docker compose up --build

# Start everything (subsequent runs)
docker compose up

# Rebuild only one service
docker compose build frontend
docker compose up frontend

# View logs
docker compose logs -f backend

# Run a command inside a container
docker compose exec frontend sh
docker compose exec backend uv run python -c "print('hello')"

# Add a Python dependency
docker compose exec backend uv add <package>

# Add a Node dependency
docker compose exec frontend npm install <package>

# Tear down
docker compose down
```

---

## Production Considerations

- Frontend: Build static assets, serve via Caddy directly (no Node runtime needed)
- Backend: Run uvicorn with `--workers 2` (audio conversion is CPU-bound)
- Caddy handles HTTPS automatically if given a domain
- Add `restart: unless-stopped` to all services
- Set memory limits on containers (audio processing can be memory-intensive)
