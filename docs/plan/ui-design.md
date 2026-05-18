# UI Design

## Design Philosophy

- **Waveform-dominant** — the waveform editor fills 80%+ of the viewport
- **Dark theme, low-fatigue** — deep charcoal backgrounds, muted accents, high-contrast selection highlights
- **Power-user density** — compact controls, keyboard-first, minimal whitespace waste
- **Contextual controls** — tools and effects appear where and when they're needed
- **Inspired by**: Sound Forge, Audacity (layout), Figma (polish), Ableton (dark aesthetic)

## Color Palette

```
Background layers:
  --bg-deep:       #0d0f12    (deepest background, behind everything)
  --bg-surface:    #141820    (main panels)
  --bg-elevated:   #1c2130    (toolbars, raised panels)
  --bg-hover:      #252d3d    (hover states)

Waveform:
  --wave-fill:     #3b82f6    (waveform body — electric blue)
  --wave-line:     #60a5fa    (waveform peaks — lighter blue)
  --wave-bg:       #0a0e14    (waveform canvas background — near black)
  --selection:     rgba(251, 191, 36, 0.25)  (amber selection overlay)
  --selection-edge:#fbbf24    (selection boundary lines — amber)
  --cursor:        #f97316    (playback cursor — orange)
  --cursor-edit:   #e2e8f0    (edit cursor — bright white)

UI elements:
  --text-primary:  #e2e8f0    (primary text — slate-200)
  --text-secondary:#94a3b8    (secondary text — slate-400)
  --text-muted:    #64748b    (disabled/hint text — slate-500)
  --accent:        #3b82f6    (primary accent — blue-500)
  --accent-hover:  #2563eb    (accent hover — blue-600)
  --danger:        #ef4444    (destructive actions)
  --success:       #22c55e    (success/positive feedback)
  --border:        #1e293b    (subtle borders — slate-800)
```

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Menu Bar                                          [Audity]    [_][x]│
│ File  Edit  View  Effects  Tools  Help                              │
├──────────────────────────────────────────────────────────────────────┤
│ Toolbar                                                             │
│ [Open][Save][Export] │ [Cut][Copy][Paste][Del] │ [Undo][Redo] │ ... │
├──────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Overview Bar (full file minimap — always visible)                  │
│  ╔══════════════════════════════════════════════════════════════════╗│
│  ║▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁ ║│
│  ║          [===========viewport========]                         ║│
│  ╚══════════════════════════════════════════════════════════════════╝│
│                                                                     │
│  Waveform Editor (main view — zoomable, scrollable)                 │
│  Time ruler: |0:00  |0:05  |0:10  |0:15  |0:20  |0:25  |0:30      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                          ▲ 1.0                                  ││
│  │          ╱╲    ╱╲╱╲                                             ││
│  │    ╱╲╱╲╱╱  ╲╱╲╱    ╲╱╲   ╱╲                                    ││
│  │───╱──────────────────────╱──╲────────────── 0.0 ────────────────││
│  │  ╱          ████SELECTION████╲    ╲╱╲                           ││
│  │╱╱           ████SELECTION████ ╲╱╲╱   ╲╱                        ││
│  │             ████SELECTION████            ▼ -1.0                 ││
│  │  ▲cursor                                                        ││
│  └──────────────────────────────────────────────────────────────────┘│
│  Scroll: [◄ ═══════════════════╤══════ ►]   Zoom: [- ████░░ +]     │
│                                                                     │
├─────────────────────┬────────────────────────────────────────────────┤
│ Transport Controls  │ Status Bar                                    │
│ [|◄][►/❚❚][■][►|]  │ Cursor: 00:12.345 │ Selection: 3.2s │ 44.1kHz│
│ [🔁 Loop]           │ Stereo │ 16-bit │ file.wav │ Zoom: 128 spp   │
└─────────────────────┴────────────────────────────────────────────────┘
```

### Collapsible Side Panel (right side, toggled via View menu or `Tab` key)

```
┌───────────────────┐
│ ≡ Recent Files    │  ← Tab 1
│                   │
│  ♪ vocals.wav     │
│    2:34 · 44.1kHz │
│    opened 2h ago  │
│                   │
│  ♪ drums.wav      │
│    1:12 · 48kHz   │
│    opened yesterday│
│                   │
│  ♪ mix-v3.wav     │
│    5:01 · 44.1kHz │
│    opened 3d ago  │
│                   │
├───────────────────┤
│ ≡ File Info       │  ← Tab 2
│                   │
│  Sample Rate: ... │
│  Channels: ...    │
│  Bit Depth: ...   │
│  Duration: ...    │
│  File Size: ...   │
├───────────────────┤
│ ≡ Effects         │  ← Tab 3
│                   │
│  [Gain/Volume]    │
│  [Normalize]      │
│  [Fade In/Out]    │
│  [Filters ►]      │
│  [Noise Reduce]   │
│  [Presets ►]      │
└───────────────────┘
```

## Component Hierarchy

```
<App>
├── <MenuBar />                    // File, Edit, View, Effects, Tools, Help
├── <Toolbar />                    // Icon buttons for frequent actions
├── <div className="editor-main">
│   ├── <WaveformOverview />       // Minimap of full file, viewport indicator
│   ├── <TimeRuler />              // Time markings above waveform
│   ├── <WaveformEditor />         // Main canvas — waveform, selection, cursors
│   │   ├── <Canvas />             // HTML5 Canvas for waveform rendering
│   │   ├── <SelectionOverlay />   // CSS overlay for selection highlight
│   │   └── <CursorLine />         // Animated playback cursor
│   ├── <ScrollZoomBar />          // Horizontal scroll + zoom controls
│   └── <SidePanel />              // Collapsible right panel
│       ├── <RecentFiles />
│       ├── <FileInfo />
│       └── <EffectsPanel />
├── <TransportBar />               // Play/pause/stop/loop + position display
├── <StatusBar />                  // File info, cursor position, selection info
└── <EffectDialog />               // Modal/drawer for configuring an effect
    ├── <EffectPreview />          // Real-time preview of effect on selection
    └── <EffectControls />         // Sliders, knobs, presets for effect params
```

## Keyboard Shortcuts (Power User)

### Transport
| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Enter` | Stop (reset to start) |
| `Shift+Space` | Play selection only |
| `L` | Toggle loop |
| `Home` | Jump to start |
| `End` | Jump to end |
| `[` / `]` | Jump to selection start / end |

### Navigation
| Key | Action |
|---|---|
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Zoom to fit entire file |
| `Ctrl+Shift+0` | Zoom to selection |
| `←` / `→` | Nudge cursor left / right |
| `Shift+←` / `Shift+→` | Extend selection left / right |
| `Ctrl+A` | Select all |
| `Escape` | Clear selection |
| `Tab` | Toggle side panel |

### Editing
| Key | Action |
|---|---|
| `Ctrl+X` | Cut |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste at cursor |
| `Delete` | Delete selection |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+T` | Trim to selection |

### File
| Key | Action |
|---|---|
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save (overwrite original) |
| `Ctrl+Shift+S` | Save as / Export |

### Effects (with selection active)
| Key | Action |
|---|---|
| `G` | Gain / Volume adjust |
| `N` | Normalize |
| `F` | Fade in |
| `Shift+F` | Fade out |
| `Ctrl+F` | Open filter dialog |

## Responsive Behavior

- **Minimum width**: 900px — below this, a "screen too narrow" message
- **Side panel**: Auto-hides below 1200px, toggle with `Tab`
- **Toolbar**: Overflows into a "more" dropdown on narrower screens
- **Waveform**: Always fills available width, height scales with viewport
- **Touch**: Not a priority; this is a desktop power-user tool

## Effect Dialog Design

When applying an effect, a dialog slides up from the bottom (or opens as a modal) with:

```
┌─────────────────────────────────────────────────┐
│ Low-Pass Filter                          [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Cutoff Frequency    [========●=========] 2000 Hz│
│  Resonance (Q)       [===●==============]  0.7  │
│  Rolloff             [12 dB/oct ▼]              │
│                                                 │
│  Preset: [None ▼]                               │
│          • Remove Hiss (8kHz cutoff)            │
│          • Warm Tone (3kHz cutoff, Q=1.2)       │
│          • Telephone Effect (3.4kHz)            │
│                                                 │
│  ┌───── Preview Waveform (before/after) ──────┐ │
│  │ ▔▔▂▄▆█▇▅▃▁▂▄▆█▇▅▃▁  →  ▔▔▂▃▅▆▆▅▃▂▁▂▃▅▆▅ │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [▶ Preview]    [Cancel]    [Apply]             │
└─────────────────────────────────────────────────┘
```

Key principles:
- **Real-time preview**: Click "Preview" to hear the effect applied to the selection before committing
- **Before/after waveform**: Visual comparison
- **Presets**: Quick access to common configurations
- **Non-modal workflow**: Effect dialog doesn't block transport controls — you can play/stop while it's open
