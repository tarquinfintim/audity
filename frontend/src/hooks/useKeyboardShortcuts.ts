import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useUIStore } from "@/store/uiStore";
import { useAudioEngine } from "./useAudioEngine";
import { CURSOR_NUDGE_SAMPLES, CURSOR_NUDGE_LARGE } from "@/lib/constants";

export function useKeyboardShortcuts() {
  const engine = useAudioEngine();

  useEffect(() => {
    /** Scroll the viewport so `sample` is visible */
    function ensureCursorVisible(sample: number) {
      const s = useEditorStore.getState();
      // We don't know canvasWidth here, so estimate from the DOM
      const el = document.querySelector("[data-waveform-editor]");
      const width = el ? el.clientWidth : 800;
      const viewStart = s.scrollOffset;
      const viewEnd = s.scrollOffset + width * s.samplesPerPixel;
      if (sample < viewStart) {
        s.setScrollOffset(Math.max(0, sample - width * s.samplesPerPixel * 0.1));
      } else if (sample > viewEnd) {
        s.setScrollOffset(sample - width * s.samplesPerPixel * 0.9);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const state = useEditorStore.getState();
      const ui = useUIStore.getState();

      // Prevent browser defaults for our shortcuts
      const key = e.key.toLowerCase();

      // --- Transport ---
      if (key === " ") {
        e.preventDefault();
        if (shift) {
          // Play selection
          engine.play();
        } else {
          engine.togglePlayback();
        }
        return;
      }
      if (key === "enter" && !ctrl) {
        e.preventDefault();
        engine.stop();
        return;
      }

      // --- File ---
      if (ctrl && key === "o") {
        e.preventDefault();
        engine.loadFile();
        return;
      }
      if (ctrl && !shift && key === "s") {
        e.preventDefault();
        engine.saveCurrentFile();
        return;
      }
      if (ctrl && shift && key === "s") {
        e.preventDefault();
        engine.saveAs();
        return;
      }

      // --- Edit ---
      if (ctrl && key === "x") {
        e.preventDefault();
        engine.cut();
        return;
      }
      if (ctrl && key === "c") {
        e.preventDefault();
        engine.copy();
        return;
      }
      if (ctrl && key === "v") {
        e.preventDefault();
        engine.paste();
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (state.selection) {
          e.preventDefault();
          engine.deleteSelection();
        }
        return;
      }
      if (ctrl && key === "t") {
        e.preventDefault();
        engine.trim();
        return;
      }
      if (ctrl && key === "z" && !shift) {
        e.preventDefault();
        state.undo();
        return;
      }
      if (ctrl && shift && key === "z") {
        e.preventDefault();
        state.redo();
        return;
      }

      // --- Selection ---
      if (ctrl && key === "a") {
        e.preventDefault();
        if (state.audioBuffer) {
          state.setSelection({ start: 0, end: state.audioBuffer.length });
        }
        return;
      }
      if (key === "escape") {
        e.preventDefault();
        state.setSelection(null);
        if (ui.effectDialog) ui.setEffectDialog(null);
        return;
      }

      // --- Cursor navigation ---
      if (key === "arrowleft" && !shift && !ctrl) {
        e.preventDefault();
        const c = Math.max(0, state.cursor - CURSOR_NUDGE_SAMPLES);
        state.setCursor(c);
        ensureCursorVisible(c);
        return;
      }
      if (key === "arrowright" && !shift && !ctrl) {
        e.preventDefault();
        const c = Math.min(
          state.cursor + CURSOR_NUDGE_SAMPLES,
          state.audioBuffer?.length ?? 0,
        );
        state.setCursor(c);
        ensureCursorVisible(c);
        return;
      }
      if (key === "arrowleft" && ctrl) {
        e.preventDefault();
        const c = Math.max(0, state.cursor - CURSOR_NUDGE_LARGE);
        state.setCursor(c);
        ensureCursorVisible(c);
        return;
      }
      if (key === "arrowright" && ctrl) {
        e.preventDefault();
        const c = Math.min(
          state.cursor + CURSOR_NUDGE_LARGE,
          state.audioBuffer?.length ?? 0,
        );
        state.setCursor(c);
        ensureCursorVisible(c);
        return;
      }

      // Shift+arrow: extend selection
      if (key === "arrowleft" && shift) {
        e.preventDefault();
        const sel = state.selection ?? {
          start: state.cursor,
          end: state.cursor,
        };
        state.setSelection({
          start: Math.max(0, sel.start - CURSOR_NUDGE_SAMPLES),
          end: sel.end,
        });
        return;
      }
      if (key === "arrowright" && shift) {
        e.preventDefault();
        const sel = state.selection ?? {
          start: state.cursor,
          end: state.cursor,
        };
        state.setSelection({
          start: sel.start,
          end: Math.min(
            sel.end + CURSOR_NUDGE_SAMPLES,
            state.audioBuffer?.length ?? 0,
          ),
        });
        return;
      }

      if (key === "home") {
        e.preventDefault();
        state.setCursor(0);
        state.setScrollOffset(0);
        return;
      }
      if (key === "end") {
        e.preventDefault();
        state.setCursor(state.audioBuffer?.length ?? 0);
        return;
      }

      // --- Zoom ---
      if (ctrl && (key === "=" || key === "+")) {
        e.preventDefault();
        state.setSamplesPerPixel(
          Math.max(1, Math.floor(state.samplesPerPixel / 2)),
        );
        return;
      }
      if (ctrl && key === "-") {
        e.preventDefault();
        state.setSamplesPerPixel(
          Math.min(65536, state.samplesPerPixel * 2),
        );
        return;
      }
      if (ctrl && key === "0" && !shift) {
        e.preventDefault();
        // Zoom to fit: will be handled by component
        return;
      }

      // --- Effects shortcuts ---
      if (key === "g" && !ctrl) {
        e.preventDefault();
        ui.setEffectDialog("gain");
        return;
      }
      if (key === "n" && !ctrl) {
        e.preventDefault();
        engine.normalizeEffect();
        return;
      }
      if (key === "f" && !ctrl && !shift) {
        e.preventDefault();
        ui.setEffectDialog("fadeIn");
        return;
      }
      if (key === "f" && shift && !ctrl) {
        e.preventDefault();
        ui.setEffectDialog("fadeOut");
        return;
      }
      if (ctrl && key === "f") {
        e.preventDefault();
        ui.setEffectDialog("filter");
        return;
      }

      // --- Loop ---
      if (key === "l" && !ctrl) {
        e.preventDefault();
        usePlaybackStore.getState().toggleLooping();
        return;
      }

      // --- Sidebar ---
      if (key === "tab" && !ctrl) {
        e.preventDefault();
        ui.toggleSidebar();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine]);

  // Prevent browser-level zoom (Ctrl/Cmd+wheel and Ctrl/Cmd+±)
  useEffect(() => {
    function preventBrowserZoom(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    }
    // passive: false is required to call preventDefault on wheel
    document.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => document.removeEventListener("wheel", preventBrowserZoom);
  }, []);
}
