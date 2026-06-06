import { useRef, useEffect, useCallback, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useUIStore } from "@/store/uiStore";
import { computePeaks } from "@/engine/waveform";
import { getPlaybackEngine } from "@/engine/playback";
import {
  MAX_SAMPLES_PER_PIXEL,
  MIN_SAMPLES_PER_PIXEL,
} from "@/lib/constants";

export function WaveformEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);

  const audioBuffer = useEditorStore((s) => s.audioBuffer);
  const cursor = useEditorStore((s) => s.cursor);
  const selection = useEditorStore((s) => s.selection);
  const samplesPerPixel = useEditorStore((s) => s.samplesPerPixel);
  const scrollOffset = useEditorStore((s) => s.scrollOffset);
  const verticalZoom = useEditorStore((s) => s.verticalZoom);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render waveform
  // Single render function that always reads fresh state from the store
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const buf = useEditorStore.getState().audioBuffer;
    if (!canvas || !buf) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const channelHeight = height / buf.numberOfChannels;
    const scaleWidth = 40;

    const state = useEditorStore.getState();
    const curOff = state.scrollOffset;
    const spp = state.samplesPerPixel;
    const cur = state.cursor;
    const sel = state.selection;
    const vZoom = state.verticalZoom;

    // Clear
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, width, height);

    // Draw each channel
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const channelData = buf.getChannelData(ch);
      const drawWidth = width - scaleWidth;
      const peaks = computePeaks(
        channelData,
        spp,
        curOff,
        Math.min(curOff + drawWidth * spp, channelData.length),
      );

      const yOffset = ch * channelHeight;
      const centerY = yOffset + channelHeight / 2;

      // Center line
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scaleWidth, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // dB grid lines
      ctx.strokeStyle = "#1a2233";
      ctx.lineWidth = 0.5;
      const dbLevels = [-6, -12, -18, -24, -36, -48];
      for (const db of dbLevels) {
        const amp = Math.pow(10, db / 20) * vZoom;
        if (amp > 1) continue;
        const yUp = centerY - amp * (channelHeight / 2);
        const yDown = centerY + amp * (channelHeight / 2);
        ctx.beginPath();
        ctx.moveTo(scaleWidth, yUp);
        ctx.lineTo(width, yUp);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(scaleWidth, yDown);
        ctx.lineTo(width, yDown);
        ctx.stroke();
      }

      // Waveform body
      ctx.fillStyle = "#3b82f6";
      ctx.globalAlpha = 0.6;
      for (let x = 0; x < Math.min(peaks.min.length, drawWidth); x++) {
        const minVal = peaks.min[x]! * vZoom;
        const maxVal = peaks.max[x]! * vZoom;
        const yMin = centerY - Math.min(1, maxVal) * (channelHeight / 2);
        const yMax = centerY - Math.max(-1, minVal) * (channelHeight / 2);
        ctx.fillRect(x + scaleWidth, yMin, 1, Math.max(1, yMax - yMin));
      }
      ctx.globalAlpha = 1;

      // Peak lines
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < Math.min(peaks.max.length, drawWidth); x++) {
        const y = centerY - Math.min(1, peaks.max[x]! * vZoom) * (channelHeight / 2);
        if (x === 0) ctx.moveTo(x + scaleWidth, y);
        else ctx.lineTo(x + scaleWidth, y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let x = 0; x < Math.min(peaks.min.length, drawWidth); x++) {
        const y = centerY - Math.max(-1, peaks.min[x]! * vZoom) * (channelHeight / 2);
        if (x === 0) ctx.moveTo(x + scaleWidth, y);
        else ctx.lineTo(x + scaleWidth, y);
      }
      ctx.stroke();

      // dB scale background
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, yOffset, scaleWidth, channelHeight);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scaleWidth, yOffset);
      ctx.lineTo(scaleWidth, yOffset + channelHeight);
      ctx.stroke();

      // dB labels
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("0", scaleWidth - 4, centerY);
      for (const db of dbLevels) {
        const amp = Math.pow(10, db / 20) * vZoom;
        if (amp > 1) continue;
        const yUp = centerY - amp * (channelHeight / 2);
        const yDown = centerY + amp * (channelHeight / 2);
        ctx.fillStyle = "#64748b";
        ctx.fillText(`${db}`, scaleWidth - 4, yUp);
        ctx.fillText(`${db}`, scaleWidth - 4, yDown);
        ctx.strokeStyle = "#475569";
        ctx.beginPath();
        ctx.moveTo(scaleWidth - 2, yUp);
        ctx.lineTo(scaleWidth, yUp);
        ctx.moveTo(scaleWidth - 2, yDown);
        ctx.lineTo(scaleWidth, yDown);
        ctx.stroke();
      }
    }

    // Selection
    if (sel) {
      const selStartPx = scaleWidth + (sel.start - curOff) / spp;
      const selEndPx = scaleWidth + (sel.end - curOff) / spp;
      ctx.fillStyle = "rgba(251, 191, 36, 0.18)";
      ctx.fillRect(selStartPx, 0, selEndPx - selStartPx, height);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(selStartPx, 0);
      ctx.lineTo(selStartPx, height);
      ctx.moveTo(selEndPx, 0);
      ctx.lineTo(selEndPx, height);
      ctx.stroke();
    }

    // Cursor
    const cursorPx = scaleWidth + (cur - curOff) / spp;
    if (cursorPx >= scaleWidth && cursorPx <= width) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorPx, 0);
      ctx.lineTo(cursorPx, height);
      ctx.stroke();
    }
  }, []);

  // Animation loop for playback cursor
  useEffect(() => {
    if (!isPlaying || !audioBuffer) return;

    let animId = 0;
    const scaleWidth = 40;

    const animate = () => {
      const engine = getPlaybackEngine();
      const timeSec = engine.currentTime;
      const sample = timeSec * audioBuffer.sampleRate;
      const store = useEditorStore.getState();

      usePlaybackStore.getState().setPlaybackPosition(timeSec);
      store.setCursor(sample);

      const drawableWidth = Math.max(canvasWidth - scaleWidth, 1);
      const viewportSamples = drawableWidth * store.samplesPerPixel;
      const cursorPx = scaleWidth + (sample - store.scrollOffset) / store.samplesPerPixel;
      const marginPx = Math.max(24, drawableWidth * 0.15);

      if (cursorPx > canvasWidth - marginPx) {
        const nextOffset = sample - (canvasWidth - scaleWidth - marginPx) * store.samplesPerPixel;
        store.setScrollOffset(Math.max(0, nextOffset));
      } else if (cursorPx < scaleWidth + marginPx) {
        const nextOffset = Math.max(0, sample - marginPx * store.samplesPerPixel);
        store.setScrollOffset(nextOffset);
      }

      renderFrame();
      animId = window.requestAnimationFrame(animate);
    };

    animId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animId);
  }, [isPlaying, audioBuffer, canvasWidth, renderFrame]);

  // Re-render on state changes when NOT playing
  useEffect(() => {
    if (!isPlaying) {
      renderFrame();
    }
  }, [audioBuffer, cursor, selection, samplesPerPixel, scrollOffset, verticalZoom, canvasWidth, isPlaying, renderFrame]);

  // Mouse interactions
  const pixelToSample = useCallback(
    (px: number) => {
      const scaleW = 40;
      return Math.max(0, Math.floor(scrollOffset + (px - scaleW) * samplesPerPixel));
    },
    [scrollOffset, samplesPerPixel],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!audioBuffer) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const sample = Math.min(pixelToSample(x), audioBuffer.length);

      if (e.shiftKey && selection) {
        // Extend selection
        useEditorStore.getState().setSelection({
          start: Math.min(selection.start, sample),
          end: Math.max(selection.end, sample),
        });
      } else {
        useEditorStore.getState().setCursor(sample);
        useEditorStore.getState().setSelection(null);
        dragStartRef.current = sample;
        setIsDragging(true);
      }
    },
    [audioBuffer, pixelToSample, selection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !audioBuffer || dragStartRef.current === null) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const sample = Math.min(
        Math.max(0, pixelToSample(x)),
        audioBuffer.length,
      );
      const start = Math.min(dragStartRef.current, sample);
      const end = Math.max(dragStartRef.current, sample);

      if (end - start > 10) {
        useEditorStore.getState().setSelection({ start, end });
      }
    },
    [isDragging, audioBuffer, pixelToSample],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Wheel zoom & scroll
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();

      const rect = canvasRef.current?.getBoundingClientRect();
      const pointerX = rect ? e.clientX - rect.left : canvasWidth / 2;
      const scaleWidth = 40;
      const pointerSample = Math.max(
        0,
        Math.floor(state.scrollOffset + (pointerX - scaleWidth) * state.samplesPerPixel),
      );

      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        state.setVerticalZoom(state.verticalZoom * factor);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0006);
        const nextSpp = Math.max(
          MIN_SAMPLES_PER_PIXEL,
          Math.min(MAX_SAMPLES_PER_PIXEL, state.samplesPerPixel * factor),
        );

        if (nextSpp !== state.samplesPerPixel) {
          const nextOffset = Math.max(
            0,
            Math.min(
              Math.max(0, (state.audioBuffer?.length ?? 0) - (canvasWidth - scaleWidth) * nextSpp),
              pointerSample - (pointerX - scaleWidth) * nextSpp,
            ),
          );
          state.setSamplesPerPixel(nextSpp);
          state.setScrollOffset(nextOffset);
        }
        return;
      }

      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const scrollDelta = dx * Math.max(1, state.samplesPerPixel / 4);
      const drawableWidth = Math.max(canvasWidth - scaleWidth, 1);
      const maxOffset = Math.max(
        0,
        (state.audioBuffer?.length ?? 0) - drawableWidth * state.samplesPerPixel,
      );
      state.setScrollOffset(
        Math.max(0, Math.min(maxOffset, state.scrollOffset + scrollDelta)),
      );
    },
    [canvasWidth],
  );

  // Drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;

      const { decodeAudioFile } = await import("@/engine/decoder");
      const { addRecentFile } = await import("@/lib/indexedDB");

      try {
        const buffer = await decodeAudioFile(file);
        useEditorStore.getState().setAudioBuffer(buffer, file.name);
        await addRecentFile({
          id: file.name + "-" + file.lastModified,
          name: file.name,
          lastOpened: Date.now(),
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          channelCount: buffer.numberOfChannels,
        });
      } catch {
        useUIStore.getState().showToast("Failed to load file");
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const canvasHeight = audioBuffer
    ? audioBuffer.numberOfChannels * 200
    : 400;

  if (!audioBuffer) {
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-wave-bg border border-dashed border-border rounded-lg m-2 cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="text-center text-text-muted">
          <p className="text-lg mb-2">Drop an audio file here</p>
          <p className="text-sm">or click to open (Ctrl+O)</p>
          <p className="text-xs mt-2 text-text-muted">Supports .wav files</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-wave-bg cursor-crosshair"
      data-waveform-editor
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="block w-full"
        style={{ height: canvasHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
