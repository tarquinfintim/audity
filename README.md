# Audity — Web Audio Editor

A browser-based single-track audio editor for power users. Load WAV files, edit with cut/copy/paste, apply effects and filters, export as MP3/OGG/FLAC.

## Quick Start

```bash
docker compose up --build
```

Open **http://localhost:3000**

## Architecture

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Zustand, Web Audio API
- **Backend**: Python 3.13, FastAPI, pydub/FFmpeg (format conversion only)
- **Proxy**: Caddy (routes `/api` → backend, everything else → frontend)

## Development

Everything runs in Docker. No local installs needed.

```bash
docker compose up          # Start all services
docker compose up --build  # Rebuild after dependency changes
docker compose logs -f     # Follow logs
```

See [docs/plan/](docs/plan/README.md) for full design documentation.
