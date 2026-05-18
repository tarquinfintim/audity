import { useEditorStore } from "@/store/editorStore";
import { formatTime, formatSamples } from "@/lib/formatTime";

export function StatusBar() {
  const cursor = useEditorStore((s) => s.cursor);
  const selection = useEditorStore((s) => s.selection);
  const sampleRate = useEditorStore((s) => s.sampleRate);
  const channelCount = useEditorStore((s) => s.channelCount);
  const fileName = useEditorStore((s) => s.fileName);
  const samplesPerPixel = useEditorStore((s) => s.samplesPerPixel);
  const modified = useEditorStore((s) => s.modified);
  const audioBuffer = useEditorStore((s) => s.audioBuffer);

  if (!audioBuffer) {
    return (
      <div className="flex items-center px-3 py-1 bg-bg-surface border-t border-border text-[11px] text-text-muted">
        <span>No file loaded</span>
      </div>
    );
  }

  const cursorTime = formatTime(cursor / sampleRate);
  const selInfo = selection
    ? `${formatSamples(selection.start, sampleRate)} → ${formatSamples(selection.end, sampleRate)} (${formatTime((selection.end - selection.start) / sampleRate)})`
    : "—";

  return (
    <div className="flex items-center px-3 py-1 bg-bg-surface border-t border-border text-[11px] text-text-muted gap-4 select-none">
      <span>
        Cursor: <span className="text-text-secondary font-mono">{cursorTime}</span>{" "}
        <span className="opacity-50">({cursor.toLocaleString()} samples)</span>
      </span>
      <Dot />
      <span>
        Sel: <span className="text-text-secondary font-mono">{selInfo}</span>
      </span>
      <Dot />
      <span>{sampleRate.toLocaleString()} Hz</span>
      <Dot />
      <span>{channelCount === 1 ? "Mono" : "Stereo"}</span>
      <Dot />
      <span>16-bit</span>
      <div className="flex-1" />
      <span>
        {fileName}
        {modified && <span className="text-accent ml-1">●</span>}
      </span>
      <Dot />
      <span>Zoom: {samplesPerPixel} spp</span>
    </div>
  );
}

function Dot() {
  return <span className="text-border">│</span>;
}
