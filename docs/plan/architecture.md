# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  React App   │  │  Web Audio   │  │ File System   │  │
│  │  (Vite/TS)   │  │  API Engine  │  │ Access API    │  │
│  │              │  │              │  │               │  │
│  │ • Waveform   │  │ • Playback   │  │ • Load files  │  │
│  │   Canvas     │  │ • DSP/Filter │  │ • Save files  │  │
│  │ • UI/Controls│  │ • AudioCtx   │  │ • File handle │  │
│  │ • State Mgmt │  │ • Worklets   │  │   persistence │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └────────┬────────┘                   │          │
│                  │                            │          │
│          ┌───────┴────────┐                   │          │
│          │  IndexedDB     │◄──────────────────┘          │
│          │  • File cache  │                              │
│          │  • Recent list │                              │
│          │  • Undo stack  │                              │
│          └────────────────┘                              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (format conversion only)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   Backend (Python)                        │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  FastAPI     │  │  FFmpeg      │  │  uv (pkg mgr)  │  │
│  │              │  │  (via        │  │                │  │
│  │ POST /encode │  │  pydub)      │  │                │  │
│  │ POST /decode │  │              │  │                │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **React 19** + **TypeScript 5** | UI components, type safety |
| Build | **Vite 6** | Fast HMR, ESBuild bundling |
| Styling | **Tailwind CSS 4** | Utility-first, dark theme |
| UI primitives | **Radix UI** | Accessible, unstyled components (menus, dialogs, sliders, tooltips) |
| Icons | **Lucide React** | Clean, consistent icon set |
| State | **Zustand** | Lightweight, no boilerplate, perfect for editor state |
| Waveform | **Custom Canvas renderer** | Full control over zoom, scroll, selection rendering |
| Audio engine | **Web Audio API** (native) | Playback, real-time filtering, AudioWorklet for DSP |
| File I/O | **File System Access API** + **IndexedDB** (via idb) | Load/save files, persist recent file handles |
| Audio decoding | **Web Audio API** `decodeAudioData()` | Decode WAV (and other browser-supported formats) to AudioBuffer |

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | **Python 3.13** | Backend language |
| Package manager | **uv** | Fast, replaces pip/venv |
| Framework | **FastAPI** | Async API server |
| Audio processing | **pydub** + **FFmpeg** | Format conversion (WAV → MP3, FLAC, OGG) |
| ASGI server | **uvicorn** | Production-ready async server |

### Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| Containerization | **Docker** + **Docker Compose** | All dev/prod environments |
| Frontend container | **Node 22 Alpine** | Vite dev server / production build |
| Backend container | **Python 3.13 Slim** + FFmpeg | API server |
| Reverse proxy | **Caddy** (or Nginx) | Route `/api` to backend, everything else to frontend |

## Data Flow

### Loading a File

```
User picks file → File System Access API → FileSystemFileHandle
  → handle.getFile() → File blob
  → AudioContext.decodeAudioData(blob) → AudioBuffer
  → Store handle reference in IndexedDB (recent files)
  → Render waveform from AudioBuffer Float32Array data
```

### Editing (e.g., Cut)

```
User selects region → Selection state (start sample, end sample)
  → Execute Cut command:
      1. Snapshot current AudioBuffer data → push to undo stack
      2. Copy selected samples to clipboard buffer
      3. Create new AudioBuffer = samples before selection + samples after selection
      4. Update waveform render
      5. Update playback source
```

### Exporting as MP3

```
AudioBuffer → encode to WAV (in-browser, raw PCM)
  → POST /api/encode { format: "mp3", bitrate: 192 }
  → Backend: pydub reads WAV, encodes MP3 via FFmpeg
  → Response: MP3 binary blob
  → File System Access API: save to disk (or download link fallback)
```

### Applying a Filter

```
User selects region → chooses filter (e.g., low-pass 2kHz)
  → Snapshot selected region → push to undo stack
  → Create OfflineAudioContext for the selected region
  → Connect: BufferSource → BiquadFilterNode → Destination
  → Render offline → get processed AudioBuffer
  → Splice processed samples back into main AudioBuffer
  → Re-render waveform
```

## State Architecture (Zustand)

```
EditorStore
├── audioBuffer: AudioBuffer | null          // Current file's decoded audio
├── originalBuffer: AudioBuffer | null       // Unmodified original for reference
├── fileName: string
├── sampleRate: number
├── duration: number
├── channelCount: number
│
├── cursor: number                           // Current cursor position (samples)
├── selection: { start: number, end: number } | null
├── zoom: { samplesPerPixel: number, scrollOffset: number }
│
├── playback: { isPlaying, isLooping, playbackPosition }
│
├── clipboard: Float32Array[] | null         // Per-channel clipboard
│
├── history: { undoStack: Command[], redoStack: Command[] }
│
├── recentFiles: FileEntry[]                 // { name, handle?, lastOpened, duration }
│
├── effects: { activeEffect, effectParams }  // Currently-open effect dialog state
│
└── ui: { sidebarOpen, sidebarTab, dialogOpen }
```

## Key Design Principles

1. **All audio processing in-browser** — The backend is only for format encoding that browsers can't do natively (MP3, FLAC). Every edit, filter, and transform runs client-side via Web Audio API.

2. **Non-destructive until export** — Edits modify the in-memory AudioBuffer. The original file on disk is never touched until the user explicitly saves/exports.

3. **Sample-accurate editing** — All operations work at the sample level, not time-based approximations. Selection, cursor, and edits are stored as sample indices.

4. **Offline rendering for effects** — Filters and effects use `OfflineAudioContext` to process audio synchronously (no real-time constraint), ensuring deterministic results.

5. **Minimal backend surface** — The backend exposes exactly two endpoints: encode and decode. No auth, no database, no file storage. Stateless.
