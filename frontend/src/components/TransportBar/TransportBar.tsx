import { useEditorStore } from "@/store/editorStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { formatTime } from "@/lib/formatTime";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
} from "lucide-react";

export function TransportBar() {
  const engine = useAudioEngine();
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isLooping = usePlaybackStore((s) => s.isLooping);
  const volume = usePlaybackStore((s) => s.volume);
  const hasBuffer = useEditorStore((s) => !!s.audioBuffer);
  const cursor = useEditorStore((s) => s.cursor);
  const sampleRate = useEditorStore((s) => s.sampleRate);
  const duration = useEditorStore((s) => s.duration);

  const cursorTime = cursor / sampleRate;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-elevated border-t border-border">
      {/* Transport buttons */}
      <div className="flex items-center gap-1">
        <TransportBtn
          icon={<SkipBack size={14} />}
          label="Start"
          onClick={() => {
            useEditorStore.getState().setCursor(0);
            useEditorStore.getState().setScrollOffset(0);
          }}
          disabled={!hasBuffer}
        />
        <TransportBtn
          icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
          label={isPlaying ? "Pause" : "Play"}
          onClick={engine.togglePlayback}
          disabled={!hasBuffer}
          primary
        />
        <TransportBtn
          icon={<Square size={14} />}
          label="Stop"
          onClick={engine.stop}
          disabled={!hasBuffer}
        />
        <TransportBtn
          icon={<SkipForward size={14} />}
          label="End"
          onClick={() => {
            const buf = useEditorStore.getState().audioBuffer;
            if (buf) useEditorStore.getState().setCursor(buf.length);
          }}
          disabled={!hasBuffer}
        />
      </div>

      {/* Loop toggle */}
      <button
        className={`px-2 py-1 rounded text-xs transition-colors ${
          isLooping
            ? "bg-accent text-white"
            : "text-text-muted hover:text-text-secondary"
        }`}
        onClick={() => usePlaybackStore.getState().toggleLooping()}
        title={isLooping ? "Loop: ON (L)" : "Loop: OFF (L)"}
      >
        <Repeat size={14} />
      </button>

      {/* Position display */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-text-secondary">
          {formatTime(cursorTime)}
        </span>
        <span className="text-text-muted">/</span>
        <span className="text-text-muted">{formatTime(duration)}</span>
      </div>

      <div className="flex-1" />

      {/* Volume */}
      <div className="flex items-center gap-2">
        <Volume2 size={14} className="text-text-muted" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            usePlaybackStore.getState().setVolume(v);
            import("@/engine/playback").then(({ getPlaybackEngine }) => {
              getPlaybackEngine().setVolume(v);
            });
          }}
          className="w-20 accent-accent"
        />
      </div>
    </div>
  );
}

function TransportBtn({
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`p-1.5 rounded transition-colors ${
        primary
          ? "bg-accent hover:bg-accent-hover text-white"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      } disabled:opacity-30 disabled:pointer-events-none`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon}
    </button>
  );
}
