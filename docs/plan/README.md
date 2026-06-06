# Audity — Web-Based Audio Editor

## Project Overview

**Audity** is a browser-based, single-track audio file editor built for power users. Think GoldWave / Sound Forge in the browser — a dominant waveform view, keyboard-driven workflows, and a rich set of DSP tools, all wrapped in a dark theme designed for focused audio work.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Track model | Single-track | Edit one file at a time; simpler UX, faster to build, cleaner architecture |
| File persistence | Browser-only (File System Access API) | No server-side file storage; files stay on user's machine. IndexedDB for recent-file list |
| Undo/Redo | Full history | Command pattern with unlimited undo stack |
| Playback | Full transport controls | Play, pause, stop, loop, play-selection, scrub, moving cursor |
| Frontend | React + Vite + TypeScript | Fast dev loop, strong ecosystem |
| UI styling | Tailwind CSS + Radix UI primitives | Maximum visual control, accessible, dark-theme-first |
| Backend | Python (FastAPI) + uv | Needed for MP3/format encoding (browser can't encode MP3 natively) |
| Infrastructure | Docker Compose (all environments) | No local framework installs; consistent dev/prod parity |

### Browser Support Note

The File System Access API (used for load/save/re-load) is supported in **Chromium-based browsers** (Chrome, Edge, Arc, Brave). Firefox and Safari will get a graceful fallback: standard file picker for loading, download-link for saving, and IndexedDB caching for recently-used file data.

---

## Plan Documents

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Tech stack, system diagram, data flow |
| [UI Design](ui-design.md) | Layout, theme, component hierarchy, keyboard shortcuts |
| [Features](features.md) | Detailed feature specs — editing, effects, filters, presets |
| [Docker & Infrastructure](docker-infrastructure.md) | Docker Compose setup, dev/prod modes, build pipeline |
| [Implementation Phases](implementation-phases.md) | Phased build plan with milestones |
| [Waveform Scroll & Zoom Refactor](waveform-scroll-zoom-refactor.md) | Focused plan for smoother playback scrolling and zoom behavior |
