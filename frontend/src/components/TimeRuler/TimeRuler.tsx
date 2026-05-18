import { useRef, useEffect, useCallback, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { TIME_RULER_HEIGHT } from "@/lib/constants";
import { formatTime } from "@/lib/formatTime";

export function TimeRuler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  const audioBuffer = useEditorStore((s) => s.audioBuffer);
  const scrollOffset = useEditorStore((s) => s.scrollOffset);
  const samplesPerPixel = useEditorStore((s) => s.samplesPerPixel);
  const sampleRate = useEditorStore((s) => s.sampleRate);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => setWidth(e[0]!.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleWidth = 40; // Match WaveformEditor's dB scale width

    ctx.fillStyle = "#141820";
    ctx.fillRect(0, 0, width, TIME_RULER_HEIGHT);

    // Calculate tick spacing using drawable area (excluding dB scale)
    const drawableWidth = width - scaleWidth;
    const secondsPerPixel = samplesPerPixel / sampleRate;
    const viewDuration = drawableWidth * secondsPerPixel;

    // Choose tick interval based on zoom
    let tickInterval = 0.001; // 1ms
    const targets = [
      0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60,
    ];
    for (const t of targets) {
      if (viewDuration / t < drawableWidth / 80) {
        tickInterval = t;
        break;
      }
    }

    const startTime = scrollOffset / sampleRate;
    const firstTick = Math.ceil(startTime / tickInterval) * tickInterval;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Inter, sans-serif";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;

    for (let t = firstTick; t < startTime + viewDuration; t += tickInterval) {
      const x = scaleWidth + (t - startTime) / secondsPerPixel;

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, TIME_RULER_HEIGHT);
      ctx.lineTo(x, TIME_RULER_HEIGHT - 8);
      ctx.stroke();

      ctx.fillText(formatTime(t), x + 3, TIME_RULER_HEIGHT - 10);
    }
  }, [audioBuffer, scrollOffset, samplesPerPixel, sampleRate, width]);

  useEffect(() => {
    render();
  }, [render]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!audioBuffer) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left - 40; // account for dB scale width
      if (x < 0) return;
      const sample = Math.floor(scrollOffset + x * samplesPerPixel);
      useEditorStore.getState().setCursor(Math.min(sample, audioBuffer.length));
    },
    [audioBuffer, scrollOffset, samplesPerPixel],
  );

  if (!audioBuffer) return null;

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={width}
        height={TIME_RULER_HEIGHT}
        className="block w-full cursor-text"
        style={{ height: TIME_RULER_HEIGHT }}
        onClick={handleClick}
      />
    </div>
  );
}
