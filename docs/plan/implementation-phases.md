# Implementation Phases

## Phase 0 — Skeleton & Infrastructure
> Get the Docker stack running with a hello-world frontend and backend

- [ ] Create `docker-compose.yml` with frontend, backend, caddy services
- [ ] Scaffold Vite + React + TypeScript project in `frontend/`
- [ ] Scaffold FastAPI project with uv in `backend/`
- [ ] Configure Caddy reverse proxy
- [ ] Verify `docker compose up` serves the app at `localhost:3000`
- [ ] Verify API proxy works (`/api/health` → backend)
- [ ] Set up Tailwind CSS with dark theme tokens (color palette from UI design doc)
- [ ] Install Radix UI primitives, Lucide icons, Zustand
- [ ] Verify hot reload works for both frontend and backend inside Docker

**Done when**: `docker compose up` from a clean clone gives you a dark-themed React page that says "Audity" and `/api/health` returns `{"status": "ok"}`

---

## Phase 1 — File Loading & Waveform Display
> Load a WAV file and see its waveform

- [ ] Implement File System Access API wrapper (`useFileSystem` hook) with `<input type="file">` fallback
- [ ] Implement WAV file loading → ArrayBuffer → `decodeAudioData()` → AudioBuffer
- [ ] Build peak computation engine (min/max per pixel column, multi-resolution cache)
- [ ] Build `<WaveformEditor />` canvas renderer — draw waveform body + peaks
- [ ] Handle mono and stereo display (stacked channels)
- [ ] Implement zoom (Ctrl+=/-, mouse wheel, zoom slider)
- [ ] Implement horizontal scroll (scroll bar, mouse wheel, keyboard)
- [ ] Build `<WaveformOverview />` minimap with viewport indicator
- [ ] Build `<TimeRuler />` with adaptive tick density
- [ ] Implement drag-and-drop file loading
- [ ] Build basic shell layout: MenuBar, Toolbar (empty buttons), waveform area, StatusBar
- [ ] StatusBar shows file metadata (name, sample rate, channels, duration)

**Done when**: You can open a `.wav` file, see its waveform rendered beautifully on a dark canvas, zoom in/out, scroll, and see the overview minimap tracking your viewport

---

## Phase 2 — Playback & Cursor
> Hear the audio and see a moving cursor

- [ ] Create AudioContext singleton manager
- [ ] Implement playback controller (play, pause, stop) using `AudioBufferSourceNode`
- [ ] Render animated playback cursor on waveform canvas (synced to `AudioContext.currentTime`)
- [ ] Build `<TransportBar />` with play/pause/stop buttons and position display
- [ ] Implement auto-scroll during playback (page-scroll mode)
- [ ] Click on waveform to set cursor position
- [ ] Click on time ruler to set cursor position
- [ ] Keyboard: Space (play/pause), Enter (stop), Home/End (jump to start/end)
- [ ] Implement cursor nudge with arrow keys
- [ ] Master volume slider (GainNode on output, doesn't modify data)

**Done when**: You can play a WAV file, see the cursor move across the waveform, click to seek, and control playback with keyboard shortcuts

---

## Phase 3 — Selection & Basic Editing
> Select regions and perform cut/copy/paste

- [ ] Implement click-drag selection on waveform (start/end sample indices)
- [ ] Render selection overlay (amber highlight) on canvas
- [ ] Selection edge handles — drag to adjust
- [ ] Shift+click to extend selection
- [ ] Shift+arrow to extend selection by nudge
- [ ] Ctrl+A to select all, Escape to clear
- [ ] Play selection (`Shift+Space`)
- [ ] StatusBar shows selection start, end, duration
- [ ] Implement clipboard buffer (per-channel Float32Arrays in memory)
- [ ] Implement Cut (Ctrl+X) — remove selection, copy to clipboard
- [ ] Implement Copy (Ctrl+C) — copy selection to clipboard
- [ ] Implement Paste (Ctrl+V) — insert clipboard at cursor / replace selection
- [ ] Implement Delete — remove selection without clipboard
- [ ] Implement Trim (Ctrl+T) — keep only selection
- [ ] Implement Silence Selection — replace selection with zeros
- [ ] Build undo/redo system (Command pattern, history manager)
- [ ] Wire all edit operations to push undo commands
- [ ] Ctrl+Z / Ctrl+Shift+Z for undo/redo
- [ ] Edit menu shows undo/redo action names

**Done when**: You can select a region, cut/copy/paste, undo/redo, and the waveform updates correctly after each operation. All keyboard shortcuts work.

---

## Phase 4 — Effects & Filters (Core Set)
> Apply gain, normalize, fade, and basic filters to selections

- [ ] Build `<EffectDialog />` component — modal with controls, preview waveform, apply/cancel
- [ ] Implement OfflineAudioContext-based effect pipeline (process selection → splice back)
- [ ] Wire effects into undo system (EffectCommand wraps before/after)
- [ ] Gain / Volume Adjust — slider -40dB to +20dB
- [ ] Normalize — peak normalize to target dB
- [ ] Fade In / Fade Out — duration + curve type (linear, log, exp, S-curve)
- [ ] Low-Pass Filter — cutoff, Q, rolloff + presets
- [ ] High-Pass Filter — cutoff, Q, rolloff + presets
- [ ] Band-Pass Filter — center freq, Q + presets
- [ ] Notch Filter — center freq, Q + presets
- [ ] Real-time preview button in effect dialog (play processed audio without committing)
- [ ] Before/after waveform preview in dialog
- [ ] Effects menu in MenuBar
- [ ] Keyboard shortcuts for common effects (G=gain, N=normalize, F=fade)

**Done when**: You can select a region, apply any of the listed filters with preview, hear the result, undo if needed, and the waveform reflects the change

---

## Phase 5 — Advanced Effects & Noise Reduction
> Parametric EQ, compressor, noise reduction, and more

- [ ] Parametric EQ — multi-band with draggable frequency response curve
- [ ] Compressor / Limiter — threshold, ratio, attack, release, makeup gain
- [ ] Reverse selection
- [ ] Invert / Phase flip
- [ ] DC Offset Removal
- [ ] Noise Reduction (spectral subtraction):
  - [ ] "Get Noise Profile" — analyze selected noise-only region
  - [ ] "Apply Reduction" — FFT-based spectral subtraction with strength control
  - [ ] AudioWorklet for FFT processing
- [ ] Presets system — built-in presets for all effects
- [ ] Effects sidebar panel with quick-apply buttons

**Done when**: Full effects suite works, noise reduction can clean up a noisy recording, EQ has a visual frequency curve

---

## Phase 6 — Export, Recent Files & Polish
> Save/export in multiple formats, recent files list, UX polish

- [ ] WAV encoding in-browser (Float32 → Int16 PCM + headers)
- [ ] Save to original file (File System Access API `write()`)
- [ ] Backend: POST `/api/encode` endpoint (WAV → MP3/OGG/FLAC via pydub+FFmpeg)
- [ ] Export dialog — choose format, bitrate, filename
- [ ] Recent files list — store in IndexedDB, show in side panel
- [ ] Re-open recent file (request permission on stored handle, or prompt re-pick)
- [ ] Side panel with tabs: Recent Files, File Info, Effects
- [ ] Loop playback mode
- [ ] Insert Silence dialog
- [ ] Clipping indicators on waveform
- [ ] Modified file indicator (dot on tab / status bar)
- [ ] Unsaved changes warning on close/navigate
- [ ] Loading/progress indicators for file decode and effect processing
- [ ] Error toasts for edge cases (file too large, unsupported format, etc.)
- [ ] Responsive toolbar overflow

**Done when**: Full workflow — open WAV, edit, apply effects, export as MP3, close, re-open from recent files list. All edges handled gracefully.

---

## Phase Summary

| Phase | Focus | Key Deliverable |
|---|---|---|
| 0 | Infrastructure | Docker stack running, dark theme shell |
| 1 | Waveform | Load WAV, render waveform, zoom/scroll |
| 2 | Playback | Audio playback with moving cursor |
| 3 | Editing | Selection, cut/copy/paste, undo/redo |
| 4 | Core Effects | Gain, normalize, fade, filters with preview |
| 5 | Advanced Effects | EQ, compressor, noise reduction |
| 6 | Polish | Export, recent files, UX polish |

Each phase builds on the previous and produces a usable (if incomplete) application. Phase 3 is the first "useful" milestone — a basic but functional audio editor.
