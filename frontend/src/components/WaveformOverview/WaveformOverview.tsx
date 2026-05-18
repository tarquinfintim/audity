import { useRef, useEffect, useCallback, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { computePeaks } from "@/engine/waveform";
import { OVERVIEW_HEIGHT } from "@/lib/constants";

export function WaveformOverview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  const audioBuffer = useEditorStore((s) => s.audioBuffer);
  const scrollOffset = useEditorStore((s) => s.scrollOffset);
  const samplesPerPixel = useEditorStore((s) => s.samplesPerPixel);

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

    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(0, 0, width, OVERVIEW_HEIGHT);

    const overviewSpp = Math.max(1, Math.ceil(audioBuffer.length / width));

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const peaks = computePeaks(audioBuffer.getChannelData(ch), overviewSpp);
      const chHeight = OVERVIEW_HEIGHT / audioBuffer.numberOfChannels;
      const yOffset = ch * chHeight;
      const centerY = yOffset + chHeight / 2;

      ctx.fillStyle = "#3b82f6";
      ctx.globalAlpha = 0.5;
      for (let x = 0; x < Math.min(peaks.min.length, width); x++) {
        const yMin = centerY - peaks.max[x]! * (chHeight / 2);
        const yMax = centerY - peaks.min[x]! * (chHeight / 2);
        ctx.fillRect(x, yMin, 1, Math.max(1, yMax - yMin));
      }
      ctx.globalAlpha = 1;
    }

    // Viewport indicator
    const viewStartPx = (scrollOffset / audioBuffer.length) * width;
    const viewWidthPx =
      ((width * samplesPerPixel) / audioBuffer.length) * width;

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      viewStartPx,
      0,
      Math.min(viewWidthPx, width - viewStartPx),
      OVERVIEW_HEIGHT,
    );
    ctx.fillStyle = "rgba(251, 191, 36, 0.08)";
    ctx.fillRect(
      viewStartPx,
      0,
      Math.min(viewWidthPx, width - viewStartPx),
      OVERVIEW_HEIGHT,
    );
  }, [audioBuffer, scrollOffset, samplesPerPixel, width]);

  useEffect(() => {
    render();
  }, [render]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!audioBuffer) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const sample = Math.max(0, Math.min(Math.floor((x / width) * audioBuffer.length), audioBuffer.length));
      const viewportSamples = width * samplesPerPixel;
      const store = useEditorStore.getState();
      store.setCursor(sample);
      store.setSelection(null);
      store.setScrollOffset(Math.max(0, sample - viewportSamples / 2));
    },
    [audioBuffer, width, samplesPerPixel],
  );

  if (!audioBuffer) return null;

  return (
    <div ref={containerRef} className="px-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={OVERVIEW_HEIGHT}
        className="block w-full rounded cursor-pointer"
        style={{ height: OVERVIEW_HEIGHT }}
        onClick={handleClick}
      />
    </div>
  );
}
