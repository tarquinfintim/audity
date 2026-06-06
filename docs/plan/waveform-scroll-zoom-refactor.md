# Waveform Scroll & Zoom Refactor Plan

## Goal
Improve the main waveform viewport so it behaves more like a professional DAW:
- smooth horizontal scrolling during playback
- predictable zoom behavior for both time and amplitude
- stable cursor behavior where the playback line stays visually anchored while the waveform moves under it

## Current pain points
1. The current scroll logic uses abrupt sample-based jumps, which makes playback feel page-like rather than smooth.
2. Horizontal zoom currently changes `samplesPerPixel` directly, but there is no dedicated viewport smoothing strategy for playback.
3. The cursor line and waveform viewport are tightly coupled to the raw sample offset, which makes the experience feel fragile when zooming or scrubbing.
4. Vertical amplitude scaling is available, but the waveform view should make the scale more readable and bounded to the signal envelope.

## Target behavior
### Time axis (horizontal)
- Zoom should stretch or compress the waveform in time.
- Wheel / trackpad gestures should feel continuous instead of jumping in large sample increments.
- During playback, the viewport should follow the cursor smoothly rather than snapping to the next page boundary.
- The cursor line should remain the visual anchor; the waveform content should move under it.

### Amplitude axis (vertical)
- A dedicated vertical zoom / gain scale should keep the waveform visible even on low-level material.
- The amplitude scale should remain bounded to the visible peak envelope instead of flattening into an almost-empty line.

## Implementation approach
1. Introduce a small viewport helper for computing:
   - visible sample span
   - scroll bounds
   - cursor visibility / follow target
2. Update the waveform canvas renderer to use a stable viewport model and a smooth `requestAnimationFrame` follow loop during playback.
3. Refine wheel handling so:
   - plain wheel = horizontal scroll
   - Ctrl/Cmd wheel = time zoom
   - Shift wheel = vertical zoom / amplitude gain
4. Keep the existing `samplesPerPixel` and `verticalZoom` concepts, but normalize them so zooming feels intentional and bounded.
5. Add a brief, documented acceptance checklist for playback, scrolling, and zoom behavior.

## Acceptance criteria
- Playback keeps the cursor visible without jittery page jumps.
- Horizontal zoom changes the visible time span smoothly.
- Vertical zoom makes low-level waveforms easier to read without collapsing the scale.
- The cursor line behaves consistently when the waveform is scrolled or zoomed.

## Notes for the implementation phase
This refactor should stay limited to the waveform editor path and the related viewport helpers. The goal is a more DAW-like feel, not a redesign of the whole UI.
