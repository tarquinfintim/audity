# Features Specification

## 1. File Operations

### 1.1 Open File
- **Trigger**: `Ctrl+O`, toolbar button, or drag-and-drop onto waveform area
- **Mechanism**: File System Access API `showOpenFilePicker()` with fallback to `<input type="file">`
- **Supported formats (input)**: `.wav` (Phase 1). Future: `.mp3`, `.ogg`, `.flac` via backend decode
- **Flow**: Pick file → read as ArrayBuffer → `AudioContext.decodeAudioData()` → populate editor state
- **Large file handling**: Show progress bar during decode. Files over 200MB should show a warning

### 1.2 Save / Save As
- **Save** (`Ctrl+S`): Write back to the original file handle (File System Access API). Encodes current AudioBuffer to WAV
- **Save As** (`Ctrl+Shift+S`): `showSaveFilePicker()` to choose location and format
- **WAV encoding**: Done entirely in-browser (write PCM headers + Float32 → Int16 conversion)
- **Fallback** (non-Chromium): Generate a download link

### 1.3 Export (Format Conversion)
- **Formats**: MP3 (128/192/256/320 kbps), OGG Vorbis, FLAC
- **Flow**: Encode to WAV in-browser → POST to `/api/encode` → receive converted blob → save
- **Dialog**: Choose format, bitrate/quality, filename

### 1.4 Recent Files List
- **Storage**: IndexedDB via `idb` library
- **Data per entry**: File name, duration, sample rate, channel count, last opened timestamp, file handle (if FSAPI), cached waveform peaks (for instant preview)
- **Re-open flow (FSAPI)**: Retrieve stored handle → `handle.requestPermission()` → if granted, read file; if denied, prompt user
- **Re-open flow (fallback)**: Show file name + metadata, prompt user to re-pick the file manually
- **Limit**: Keep last 20 files. LRU eviction

---

## 2. Waveform Display

### 2.1 Rendering
- **Technology**: HTML5 Canvas (2D context), double-buffered
- **Data**: Pre-computed peaks (min/max per pixel column) from AudioBuffer Float32Array
- **Channels**: Mono → single waveform. Stereo → two vertically stacked waveforms (top=L, bottom=R)
- **Style**: Filled waveform body (gradient from center), peak lines on top
- **Performance**: Render only visible portion. Cache peaks at multiple zoom levels. Use `requestAnimationFrame` for smooth updates

### 2.2 Overview Bar
- **Always visible** above the main waveform
- **Shows entire file** as a condensed waveform
- **Viewport indicator**: Highlighted rectangle showing what portion is visible in the main editor
- **Interaction**: Click to jump, drag to scroll, drag edges to resize viewport (zoom)

### 2.3 Zoom
- **Zoom levels**: From ~1 sample/pixel (maximum zoom) to full-file-in-view (minimum)
- **Controls**: `Ctrl+=/Ctrl+-`, mouse wheel with Ctrl, zoom slider in scroll bar, pinch (trackpad)
- **Zoom anchor**: Zoom centered on cursor position (or mouse position if using wheel)
- **Samples per pixel (SPP)**: Stored in state, determines resolution

### 2.4 Scroll
- **Horizontal scroll**: Scroll bar below waveform, mouse wheel (without Ctrl), click-drag on overview viewport
- **Auto-scroll during playback**: Waveform scrolls to keep playback cursor visible. Options: page-scroll (jump when cursor reaches edge) or smooth-scroll (cursor stays centered)

### 2.5 Time Ruler
- **Position**: Above the waveform canvas
- **Format**: `MM:SS.mmm` (minutes, seconds, milliseconds)
- **Tick density**: Adapts to zoom level — more ticks when zoomed in
- **Click**: Clicking the ruler sets cursor position

---

## 3. Selection & Cursor

### 3.1 Cursor
- **Visual**: Thin vertical line (bright white/orange)
- **Set by**: Clicking on waveform, keyboard arrows, clicking time ruler
- **Nudge**: `←`/`→` moves cursor by 1 pixel-worth of samples. `Ctrl+←`/`Ctrl+→` moves by larger increments (0.1s)
- **Position display**: Shown in status bar as `HH:MM:SS.mmm` and sample index

### 3.2 Selection
- **Create**: Click-drag on waveform
- **Adjust**: Drag selection edges (handles appear on hover). `Shift+click` extends selection. `Shift+←`/`Shift+→` extends by nudge amount
- **Visual**: Semi-transparent amber overlay on selected region, bright amber edge lines
- **Info**: Status bar shows selection start, end, and duration
- **Select All**: `Ctrl+A`
- **Clear**: `Escape` or click without drag

### 3.3 Selection Snapping (future)
- Snap to zero-crossings to avoid clicks/pops at edit boundaries

---

## 4. Edit Operations

All edit operations push to the undo stack before executing.

### 4.1 Cut (`Ctrl+X`)
- **Requires**: Active selection
- **Action**: Remove selected audio, copy to clipboard buffer, close the gap
- **Result**: File is shortened by selection length. Cursor placed at cut point

### 4.2 Copy (`Ctrl+C`)
- **Requires**: Active selection
- **Action**: Copy selected audio to clipboard buffer (per-channel Float32Arrays)
- **Result**: No change to audio. Selection remains

### 4.3 Paste (`Ctrl+V`)
- **Requires**: Clipboard has data
- **Behavior**: Insert clipboard audio at cursor position. If selection is active, replace selection with clipboard contents
- **Channel mismatch**: If pasting mono into stereo (or vice versa), duplicate/downmix automatically

### 4.4 Delete (`Delete`)
- **Requires**: Active selection
- **Action**: Remove selected audio, close the gap. Does NOT copy to clipboard
- **Result**: File is shortened. Cursor at deletion point

### 4.5 Trim (`Ctrl+T`)
- **Requires**: Active selection
- **Action**: Delete everything OUTSIDE the selection. Keep only selected region
- **Result**: File becomes the selection length

### 4.6 Silence Selection
- **Action**: Replace selected region with silence (zeros). Does NOT change file length
- **Useful for**: Removing unwanted sounds without altering timing

### 4.7 Insert Silence
- **Action**: Insert N seconds of silence at cursor position
- **Dialog**: Input duration in seconds

---

## 5. Undo / Redo

### 5.1 Architecture
- **Pattern**: Command pattern. Each edit creates a Command object with `execute()` and `undo()` methods
- **Storage**: Undo stack (array of commands), Redo stack (cleared on new edit)
- **Granularity**: Each discrete action is one undo step (one cut = one undo)

### 5.2 Memory Management
- **Strategy**: Store diffs, not full copies. For operations like cut/paste, store only the affected region + position metadata
- **Limit**: Cap undo stack at 100 operations or ~500MB of stored audio data (whichever comes first)
- **Warning**: Show indicator when approaching memory limit

### 5.3 Controls
- `Ctrl+Z` — Undo
- `Ctrl+Shift+Z` — Redo
- Edit menu shows next undo/redo action name: "Undo Cut", "Redo Paste"

---

## 6. Playback & Transport

### 6.1 Transport Controls
- **Play** (`Space`): Start playback from cursor. If selection exists, play from selection start
- **Pause** (`Space` again): Pause at current position
- **Stop** (`Enter` or `Escape` during playback): Stop and return cursor to where playback started
- **Play Selection** (`Shift+Space`): Play only the selected region
- **Loop** (`L`): Toggle loop mode. When on, playback loops the selection (or entire file if no selection)

### 6.2 Playback Cursor
- **Visual**: Bright orange vertical line, distinct from edit cursor
- **Animation**: Smooth movement via `requestAnimationFrame`, synced to `AudioContext.currentTime`
- **Auto-scroll**: Waveform view follows playback cursor

### 6.3 Scrubbing (future enhancement)
- Click-drag on time ruler to scrub through audio

### 6.4 Volume
- Master volume slider in transport bar
- Does NOT affect the audio data, only playback level

---

## 7. Effects & Filters

All effects operate on the **selected region** (or entire file if no selection). Each shows a dialog with controls, preview, and presets.

### 7.1 Gain / Volume Adjust
- **Controls**: Slider from -40 dB to +20 dB, with numeric input
- **Preview**: Real-time audible preview + waveform before/after
- **Use case**: Boost quiet sections, reduce loud sections

### 7.2 Normalize
- **Mode**: Peak normalization (scale to target peak level)
- **Controls**: Target level (default: -0.1 dB), per-channel or linked
- **Use case**: Maximize volume without clipping

### 7.3 Fade In / Fade Out
- **Controls**: Duration (seconds), curve type (linear, logarithmic, exponential, S-curve)
- **Behavior**: Fade In applies from selection start, Fade Out applies to selection end
- **Visual**: Shows fade curve overlaid on waveform in preview

### 7.4 Low-Pass Filter
- **Controls**: Cutoff frequency (20Hz – 20kHz), resonance/Q (0.1 – 20), rolloff (12/24 dB/oct)
- **Implementation**: Web Audio `BiquadFilterNode` type `lowpass`
- **Use case**: Remove high-frequency hiss, harsh sibilance
- **Presets**:
  - *Remove Hiss* — 6kHz cutoff, Q=0.7
  - *Warm Tone* — 3kHz cutoff, Q=1.0
  - *Telephone Effect* — 3.4kHz cutoff, Q=0.5
  - *Subwoofer* — 200Hz cutoff, Q=0.7

### 7.5 High-Pass Filter
- **Controls**: Cutoff frequency, resonance/Q, rolloff
- **Implementation**: `BiquadFilterNode` type `highpass`
- **Use case**: Remove rumble, low-frequency hum, wind noise
- **Presets**:
  - *Remove Rumble* — 80Hz cutoff
  - *Remove Hum (50Hz)* — 55Hz cutoff, steep rolloff
  - *Remove Hum (60Hz)* — 65Hz cutoff, steep rolloff
  - *Voice Clarity* — 120Hz cutoff, Q=0.7

### 7.6 Band-Pass Filter
- **Controls**: Center frequency, bandwidth/Q
- **Implementation**: `BiquadFilterNode` type `bandpass`
- **Use case**: Isolate specific frequency ranges
- **Presets**:
  - *Voice Band* — 300Hz – 3.4kHz
  - *Presence Boost* — 2kHz – 5kHz

### 7.7 Notch Filter (Band-Reject)
- **Controls**: Center frequency, Q (narrowness)
- **Implementation**: `BiquadFilterNode` type `notch`
- **Use case**: Remove specific tonal interference (hum, buzz)
- **Presets**:
  - *Kill 50Hz Hum* — 50Hz, Q=30
  - *Kill 60Hz Hum* — 60Hz, Q=30

### 7.8 Parametric EQ (Multi-Band)
- **Controls**: 3-8 bands, each with frequency, gain, Q, type (peak/shelf/pass)
- **Implementation**: Chain of `BiquadFilterNode`s
- **Visual**: Interactive frequency response curve (draggable nodes)
- **Presets**:
  - *Voice Enhance* — boost 2-5kHz presence, cut 200Hz mud
  - *De-Mud* — cut 200-400Hz
  - *Air* — shelf boost above 10kHz
  - *Broadcast Ready* — standard voice processing curve

### 7.9 Noise Reduction (Spectral)
- **Two-step workflow**:
  1. **Profile noise**: User selects a region of "only noise" (no desired signal), click "Get Noise Profile"
  2. **Apply reduction**: Select the region to clean, adjust strength slider, apply
- **Controls**: Reduction strength (0-100%), smoothing, frequency resolution
- **Implementation**: FFT-based spectral subtraction using AudioWorklet
  - Compute noise spectrum from profile
  - For each frame of the target audio, subtract noise spectrum (with smoothing)
  - Inverse FFT back to time domain
- **Presets**:
  - *Light Denoise* — 30% reduction, high smoothing (preserves quality)
  - *Medium Denoise* — 60% reduction
  - *Aggressive Denoise* — 90% reduction (may introduce artifacts)

### 7.10 Compressor / Limiter
- **Controls**: Threshold, ratio, attack, release, makeup gain, knee
- **Implementation**: `DynamicsCompressorNode` (Web Audio native)
- **Use case**: Even out dynamic range, prevent clipping
- **Presets**:
  - *Gentle Compression* — threshold -20dB, ratio 2:1
  - *Voice Leveler* — threshold -15dB, ratio 4:1, fast attack
  - *Brick Wall Limiter* — threshold -1dB, ratio 20:1

### 7.11 Reverse
- **Action**: Reverse the selected audio (or entire file)
- **Implementation**: Reverse the Float32Array samples in-place
- **No dialog needed** — immediate action with undo

### 7.12 Invert / Phase Flip
- **Action**: Multiply all samples by -1
- **Use case**: Fix phase issues
- **No dialog needed**

### 7.13 DC Offset Removal
- **Action**: Calculate mean of all samples, subtract it
- **Use case**: Fix recordings with DC offset that causes asymmetric waveforms

### 7.14 Speed / Pitch (future)
- Change playback speed without affecting pitch (time stretch)
- Change pitch without affecting speed (pitch shift)
- Requires more advanced DSP (phase vocoder) — can be a Phase 2+ feature

---

## 8. Presets System

### 8.1 Built-in Presets
- Each effect ships with curated presets (listed above per effect)
- Presets are labeled by use case, not technical parameters

### 8.2 Custom Presets (future)
- Save current effect settings as a named preset
- Store in IndexedDB
- Export/import presets as JSON

### 8.3 Quick-Apply Presets
- Effects panel in sidebar shows "quick apply" buttons for common presets
- One click to apply to selection without opening the full dialog

---

## 9. Status Bar

Always visible at the bottom. Shows contextual information:

```
Cursor: 00:12.345 (546,732 samples) │ Sel: 00:12.345 → 00:15.567 (3.222s) │ 44,100 Hz │ Stereo │ 16-bit │ vocals.wav │ Zoom: 128 spp │ Modified
```

- **Cursor position**: Time + sample index
- **Selection info**: Start, end, duration (when selection is active)
- **File metadata**: Sample rate, channels, bit depth, filename
- **Zoom level**: Samples per pixel
- **Modified indicator**: Shows when file has unsaved changes

---

## 10. Accessibility & UX Details

### 10.1 Visual Feedback
- **Operations**: Brief flash/highlight on waveform when an edit is applied
- **Clipping indicator**: Red highlight on waveform peaks that exceed 0 dBFS
- **Effect preview**: Waveform shows before/after overlay

### 10.2 Error Handling
- **File too large**: Warning dialog with file size, estimated memory usage
- **Unsupported format**: Clear error message with supported format list
- **Browser incompatible**: Graceful degradation message for non-Chromium browsers re: FSAPI
- **Memory pressure**: Monitor `performance.memory` (Chrome), warn when approaching limits

### 10.3 Drag & Drop
- Drop audio files anywhere on the app to open them
- Visual drop zone indicator with supported format hint
