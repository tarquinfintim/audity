import { useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useUIStore } from "@/store/uiStore";
import { openAudioFile, saveFile } from "@/lib/fileSystemAccess";
import { addRecentFile } from "@/lib/indexedDB";
import { applyBackendEffect } from "@/lib/backendEffects";
import { decodeAudioFile } from "@/engine/decoder";
import { encodeWav } from "@/engine/encoder";
import { cloneAudioBuffer } from "@/engine/effects/gain";
import {
  applyGain,
  applyNormalize,
  applyFadeIn,
  applyFadeOut,
  applyReverse,
  applyInvert,
  applyDcOffsetRemoval,
  applySilence,
} from "@/engine/effects";
import type { FadeCurve } from "@/engine/effects";
import { getPlaybackEngine } from "@/engine/playback";

export function useAudioEngine() {
  const store = useEditorStore;
  const showToast = useUIStore.getState().showToast;
  const setProcessing = useUIStore.getState().setProcessing;

  const loadFile = useCallback(async () => {
    try {
      const { file, handle } = await openAudioFile();
      const buffer = await decodeAudioFile(file);
      useEditorStore.getState().setAudioBuffer(buffer, file.name, handle);

      await addRecentFile({
        id: file.name + "-" + file.lastModified,
        name: file.name,
        lastOpened: Date.now(),
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channelCount: buffer.numberOfChannels,
      });

      showToast(`Loaded ${file.name}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("cancelled")) return;
      showToast(`Error loading file: ${e instanceof Error ? e.message : e}`);
    }
  }, [showToast]);

  const saveCurrentFile = useCallback(async () => {
    const { audioBuffer, fileName, fileHandle } = store.getState();
    if (!audioBuffer) return;
    const blob = encodeWav(audioBuffer);
    const handle = await saveFile(blob, fileName, fileHandle ?? undefined);
    if (handle) store.getState().setFileHandle(handle);
    store.getState().setModified(false);
    showToast("Saved");
  }, [showToast]);

  const saveAs = useCallback(async () => {
    const { audioBuffer, fileName } = store.getState();
    if (!audioBuffer) return;
    const blob = encodeWav(audioBuffer);
    // Always prompt for a new location (no existing handle)
    const handle = await saveFile(blob, fileName);
    if (handle) {
      store.getState().setFileHandle(handle);
      store.getState().setModified(false);
      showToast("Saved as new file");
    }
  }, [showToast]);

  const exportFile = useCallback(
    async (format: string, bitrate: string = "192k") => {
      const { audioBuffer, fileName } = store.getState();
      if (!audioBuffer) return;

      setProcessing(true);
      try {
        const wavBlob = encodeWav(audioBuffer);
        const formData = new FormData();
        formData.append("file", wavBlob, "audio.wav");
        formData.append("format", format);
        formData.append("bitrate", bitrate);

        const resp = await fetch("/api/encode", {
          method: "POST",
          body: formData,
        });

        if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

        const blob = await resp.blob();
        const baseName = fileName.replace(/\.[^.]+$/, "");
        const exportName = `${baseName}.${format}`;

        // Force a download — showSaveFilePicker won't work here because
        // the user-gesture context is lost after the async fetch.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = exportName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        showToast(`Exported as ${exportName}`);
      } catch (e: unknown) {
        showToast(`Export failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setProcessing(false);
      }
    },
    [showToast, setProcessing],
  );

  // ---- Edit operations ----

  const cut = useCallback(() => {
    const state = store.getState();
    const { audioBuffer, selection } = state;
    if (!audioBuffer || !selection) return;

    const { start, end } = selection;
    // Copy to clipboard
    const clipboardData: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      clipboardData.push(channelData.slice(start, end));
    }
    state.setClipboard(clipboardData);

    // Create new buffer without the selection
    const newLength = audioBuffer.length - (end - start);
    const ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );
    const newBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const oldData = audioBuffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      // Copy before selection
      for (let i = 0; i < start; i++) newData[i] = oldData[i]!;
      // Copy after selection
      for (let i = end; i < audioBuffer.length; i++)
        newData[i - (end - start)] = oldData[i]!;
    }

    const prevBuffer = audioBuffer;
    const prevSelection = selection;
    const prevCursor = state.cursor;

    state.pushUndo({
      name: "Cut",
      execute: () => {
        store.getState().replaceAudioBuffer(newBuffer);
        store.getState().setCursor(start);
        store.getState().setSelection(null);
      },
      undo: () => {
        store.getState().replaceAudioBuffer(prevBuffer);
        store.getState().setCursor(prevCursor);
        store.getState().setSelection(prevSelection);
        store.getState().setClipboard(clipboardData);
      },
    });

    state.replaceAudioBuffer(newBuffer);
    state.setCursor(start);
    state.setSelection(null);
  }, []);

  const copy = useCallback(() => {
    const { audioBuffer, selection } = store.getState();
    if (!audioBuffer || !selection) return;

    const clipboardData: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      clipboardData.push(channelData.slice(selection.start, selection.end));
    }
    store.getState().setClipboard(clipboardData);
    showToast("Copied");
  }, [showToast]);

  const paste = useCallback(() => {
    const state = store.getState();
    const { audioBuffer, clipboard, cursor, selection } = state;
    if (!audioBuffer || !clipboard) return;

    const insertAt = selection ? selection.start : cursor;
    const removeEnd = selection ? selection.end : cursor;
    const removeLength = removeEnd - insertAt;
    const insertLength = clipboard[0]!.length;

    const newLength = audioBuffer.length - removeLength + insertLength;
    const ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );
    const newBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const oldData = audioBuffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      const clipData = clipboard[ch % clipboard.length]!;

      // Before insert point
      for (let i = 0; i < insertAt; i++) newData[i] = oldData[i]!;
      // Paste clipboard
      for (let i = 0; i < insertLength; i++)
        newData[insertAt + i] = clipData[i]!;
      // After removed region
      for (let i = removeEnd; i < audioBuffer.length; i++)
        newData[i - removeLength + insertLength] = oldData[i]!;
    }

    const prevBuffer = audioBuffer;
    const prevSelection = selection;
    const prevCursor = cursor;

    state.pushUndo({
      name: "Paste",
      execute: () => {
        store.getState().replaceAudioBuffer(newBuffer);
        store.getState().setCursor(insertAt + insertLength);
        store.getState().setSelection(null);
      },
      undo: () => {
        store.getState().replaceAudioBuffer(prevBuffer);
        store.getState().setCursor(prevCursor);
        store.getState().setSelection(prevSelection);
      },
    });

    state.replaceAudioBuffer(newBuffer);
    state.setCursor(insertAt + insertLength);
    state.setSelection(null);
  }, []);

  const deleteSelection = useCallback(() => {
    const state = store.getState();
    const { audioBuffer, selection } = state;
    if (!audioBuffer || !selection) return;

    const { start, end } = selection;
    const newLength = audioBuffer.length - (end - start);
    const ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );
    const newBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const oldData = audioBuffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      for (let i = 0; i < start; i++) newData[i] = oldData[i]!;
      for (let i = end; i < audioBuffer.length; i++)
        newData[i - (end - start)] = oldData[i]!;
    }

    const prevBuffer = audioBuffer;
    const prevSelection = selection;

    state.pushUndo({
      name: "Delete",
      execute: () => {
        store.getState().replaceAudioBuffer(newBuffer);
        store.getState().setCursor(start);
        store.getState().setSelection(null);
      },
      undo: () => {
        store.getState().replaceAudioBuffer(prevBuffer);
        store.getState().setSelection(prevSelection);
      },
    });

    state.replaceAudioBuffer(newBuffer);
    state.setCursor(start);
    state.setSelection(null);
  }, []);

  const trim = useCallback(() => {
    const state = store.getState();
    const { audioBuffer, selection } = state;
    if (!audioBuffer || !selection) return;

    const { start, end } = selection;
    const newLength = end - start;
    const ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );
    const newBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      Math.max(1, newLength),
      audioBuffer.sampleRate,
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const oldData = audioBuffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      for (let i = 0; i < newLength; i++) newData[i] = oldData[start + i]!;
    }

    const prevBuffer = audioBuffer;

    state.pushUndo({
      name: "Trim",
      execute: () => {
        store.getState().replaceAudioBuffer(newBuffer);
        store.getState().setCursor(0);
        store.getState().setSelection(null);
      },
      undo: () => {
        store.getState().replaceAudioBuffer(prevBuffer);
        store.getState().setSelection(selection);
      },
    });

    state.replaceAudioBuffer(newBuffer);
    state.setCursor(0);
    state.setSelection(null);
    state.setScrollOffset(0);
  }, []);

  // ---- Effect helpers ----

  const applyEffect = useCallback(
    async (
      name: string,
      fn: (
        buf: AudioBuffer,
        start: number,
        end: number,
      ) => Promise<AudioBuffer>,
    ) => {
      const state = store.getState();
      const { audioBuffer } = state;
      if (!audioBuffer) return;

      const { start, end } = state.getSelectionOrAll();
      setProcessing(true);

      try {
        const newBuffer = await fn(audioBuffer, start, end);
        const prevBuffer = audioBuffer;

        state.pushUndo({
          name,
          execute: () => store.getState().replaceAudioBuffer(newBuffer),
          undo: () => store.getState().replaceAudioBuffer(prevBuffer),
        });

        state.replaceAudioBuffer(newBuffer);
        showToast(`Applied ${name}`);
      } catch (e: unknown) {
        showToast(`Effect failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setProcessing(false);
      }
    },
    [showToast, setProcessing],
  );

  /** Wrapper for effects that run on the backend via API */
  const applyBackendEffectWrapped = useCallback(
    async (name: string, endpoint: string, params: Record<string, string | number>) => {
      const state = store.getState();
      const { audioBuffer } = state;
      if (!audioBuffer) return;

      const { start, end } = state.getSelectionOrAll();
      setProcessing(true);

      try {
        const newBuffer = await applyBackendEffect({
          endpoint,
          buffer: audioBuffer,
          startSample: start,
          endSample: end,
          params,
        });

        const prevBuffer = audioBuffer;
        state.pushUndo({
          name,
          execute: () => store.getState().replaceAudioBuffer(newBuffer),
          undo: () => store.getState().replaceAudioBuffer(prevBuffer),
        });

        state.replaceAudioBuffer(newBuffer);
        showToast(`Applied ${name}`);
      } catch (e: unknown) {
        showToast(`Effect failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setProcessing(false);
      }
    },
    [showToast, setProcessing],
  );

  const gainEffect = useCallback(
    (db: number) => applyEffect("Gain", (buf, s, e) => applyGain(buf, s, e, db)),
    [applyEffect],
  );

  const normalizeEffect = useCallback(
    (targetDb?: number) =>
      applyEffect("Normalize", (buf, s, e) => applyNormalize(buf, s, e, targetDb)),
    [applyEffect],
  );

  const fadeInEffect = useCallback(
    (curve?: FadeCurve) =>
      applyEffect("Fade In", (buf, s, e) => applyFadeIn(buf, s, e, curve)),
    [applyEffect],
  );

  const fadeOutEffect = useCallback(
    (curve?: FadeCurve) =>
      applyEffect("Fade Out", (buf, s, e) => applyFadeOut(buf, s, e, curve)),
    [applyEffect],
  );

  const filterEffect = useCallback(
    (params: { type: string; frequency: number; Q: number }) =>
      applyBackendEffectWrapped("Filter", "/api/effects/filter", {
        filter_type: params.type,
        frequency: params.frequency,
        q: params.Q,
      }),
    [applyBackendEffectWrapped],
  );

  const compressorEffect = useCallback(
    (params: {
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
      knee: number;
      makeupGain: number;
    }) =>
      applyBackendEffectWrapped("Compressor", "/api/effects/compressor", {
        threshold_db: params.threshold,
        ratio: params.ratio,
        attack: params.attack,
        release: params.release,
        knee_db: params.knee,
        makeup_gain_db: params.makeupGain,
      }),
    [applyBackendEffectWrapped],
  );

  const noiseReductionEffect = useCallback(
    (strength: number, noiseStart?: number, noiseEnd?: number) => {
      const state = store.getState();
      const { audioBuffer } = state;
      if (!audioBuffer) return Promise.resolve();

      const { start, end } = state.getSelectionOrAll();
      setProcessing(true);

      // Build noise profile buffer if we have stored noise region
      const noiseInfo = (window as any).__audityNoiseRegion as
        | { start: number; end: number }
        | undefined;

      return applyBackendEffect({
        endpoint: "/api/effects/noise-reduce",
        buffer: audioBuffer,
        startSample: start,
        endSample: end,
        params: { strength },
        noiseBuffer: noiseInfo ? audioBuffer : undefined,
        noiseStart: noiseInfo?.start ?? noiseStart,
        noiseEnd: noiseInfo?.end ?? noiseEnd,
      })
        .then((newBuffer) => {
          const prevBuffer = audioBuffer;
          state.pushUndo({
            name: "Noise Reduction",
            execute: () => store.getState().replaceAudioBuffer(newBuffer),
            undo: () => store.getState().replaceAudioBuffer(prevBuffer),
          });
          state.replaceAudioBuffer(newBuffer);
          showToast("Applied Noise Reduction");
        })
        .catch((e: unknown) => {
          showToast(`Effect failed: ${e instanceof Error ? e.message : e}`);
        })
        .finally(() => setProcessing(false));
    },
    [showToast, setProcessing],
  );

  const adaptiveGateEffect = useCallback(
    (params: {
      thresholdMarginDb: number;
      lookaheadMs: number;
      attackMs: number;
      holdMs: number;
      releaseMs: number;
    }) => {
      const state = store.getState();
      const { audioBuffer } = state;
      if (!audioBuffer) return Promise.resolve();

      const { start, end } = state.getSelectionOrAll();
      setProcessing(true);

      const noiseInfo = (window as any).__audityNoiseRegion as
        | { start: number; end: number }
        | undefined;

      return applyBackendEffect({
        endpoint: "/api/effects/adaptive-gate",
        buffer: audioBuffer,
        startSample: start,
        endSample: end,
        params: {
          threshold_margin_db: params.thresholdMarginDb,
          lookahead_ms: params.lookaheadMs,
          attack_ms: params.attackMs,
          hold_ms: params.holdMs,
          release_ms: params.releaseMs,
        },
        noiseBuffer: noiseInfo ? audioBuffer : undefined,
        noiseStart: noiseInfo?.start,
        noiseEnd: noiseInfo?.end,
      })
        .then((newBuffer) => {
          const prevBuffer = audioBuffer;
          state.pushUndo({
            name: "Adaptive Background Muting",
            execute: () => store.getState().replaceAudioBuffer(newBuffer),
            undo: () => store.getState().replaceAudioBuffer(prevBuffer),
          });
          state.replaceAudioBuffer(newBuffer);
          showToast("Applied Adaptive Background Muting");
        })
        .catch((e: unknown) => {
          showToast(`Effect failed: ${e instanceof Error ? e.message : e}`);
        })
        .finally(() => setProcessing(false));
    },
    [showToast, setProcessing],
  );

  const reverseEffect = useCallback(
    () => applyEffect("Reverse", applyReverse),
    [applyEffect],
  );

  const invertEffect = useCallback(
    () => applyEffect("Invert", applyInvert),
    [applyEffect],
  );

  const dcOffsetEffect = useCallback(
    () => applyEffect("DC Offset Removal", applyDcOffsetRemoval),
    [applyEffect],
  );

  const silenceEffect = useCallback(
    () => applyEffect("Silence", applySilence),
    [applyEffect],
  );

  // ---- Playback ----

  const play = useCallback(() => {
    const state = store.getState();
    const { audioBuffer, cursor, selection } = state;
    if (!audioBuffer) return;

    const engine = getPlaybackEngine();
    const playbackStore = usePlaybackStore.getState();
    engine.setVolume(playbackStore.volume);
    engine.setLoop(playbackStore.isLooping);

    const startSec = cursor / audioBuffer.sampleRate;
    const selStartSec = selection
      ? selection.start / audioBuffer.sampleRate
      : undefined;
    const selEndSec = selection
      ? selection.end / audioBuffer.sampleRate
      : undefined;

    engine.play(audioBuffer, startSec, selStartSec, selEndSec, () => {
      usePlaybackStore.getState().setPlaying(false);
    });

    playbackStore.setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    const engine = getPlaybackEngine();
    engine.pause();
    usePlaybackStore.getState().setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const engine = getPlaybackEngine();
    engine.stop();
    usePlaybackStore.getState().setPlaying(false);
    usePlaybackStore.getState().setPlaybackPosition(0);
  }, []);

  const togglePlayback = useCallback(() => {
    const { isPlaying } = usePlaybackStore.getState();
    if (isPlaying) pause();
    else play();
  }, [play, pause]);

  return {
    loadFile,
    saveCurrentFile,
    saveAs,
    exportFile,
    cut,
    copy,
    paste,
    deleteSelection,
    trim,
    gainEffect,
    normalizeEffect,
    fadeInEffect,
    fadeOutEffect,
    filterEffect,
    compressorEffect,
    noiseReductionEffect,
    adaptiveGateEffect,
    reverseEffect,
    invertEffect,
    dcOffsetEffect,
    silenceEffect,
    applyEffect,
    play,
    pause,
    stop,
    togglePlayback,
  };
}
