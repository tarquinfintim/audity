import { useEffect, useState } from "react";
import { useUIStore, type SidebarTab } from "@/store/uiStore";
import { useEditorStore } from "@/store/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { getRecentFiles, type RecentFileEntry } from "@/lib/indexedDB";
import { formatTime } from "@/lib/formatTime";
import { FILTER_PRESETS } from "@/engine/effects/filter";
import { COMPRESSOR_PRESETS } from "@/engine/effects/compressor";
import {
  Clock,
  Info,
  Sparkles,
  FileAudio,
  ChevronRight,
} from "lucide-react";

export function SidePanel() {
  const isOpen = useUIStore((s) => s.sidebarOpen);
  const tab = useUIStore((s) => s.sidebarTab);
  const setTab = useUIStore((s) => s.setSidebarTab);

  if (!isOpen) return null;

  return (
    <div className="w-64 bg-bg-surface border-l border-border flex flex-col shrink-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <TabBtn
          icon={<Clock size={14} />}
          label="Files"
          active={tab === "files"}
          onClick={() => setTab("files")}
        />
        <TabBtn
          icon={<Info size={14} />}
          label="Info"
          active={tab === "info"}
          onClick={() => setTab("info")}
        />
        <TabBtn
          icon={<Sparkles size={14} />}
          label="Effects"
          active={tab === "effects"}
          onClick={() => setTab("effects")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {tab === "files" && <RecentFilesTab />}
        {tab === "info" && <FileInfoTab />}
        {tab === "effects" && <EffectsTab />}
      </div>
    </div>
  );
}

function TabBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
        active
          ? "text-accent border-b-2 border-accent"
          : "text-text-muted hover:text-text-secondary"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function RecentFilesTab() {
  const [files, setFiles] = useState<RecentFileEntry[]>([]);

  useEffect(() => {
    getRecentFiles().then(setFiles);
  }, []);

  if (files.length === 0) {
    return (
      <p className="text-text-muted text-xs text-center mt-4">
        No recent files
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-start gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer transition-colors"
        >
          <FileAudio size={14} className="text-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-text-primary truncate">{f.name}</p>
            <p className="text-[10px] text-text-muted">
              {formatTime(f.duration)} · {f.sampleRate / 1000}kHz ·{" "}
              {timeAgo(f.lastOpened)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FileInfoTab() {
  const buf = useEditorStore((s) => s.audioBuffer);
  const fileName = useEditorStore((s) => s.fileName);

  if (!buf) {
    return (
      <p className="text-text-muted text-xs text-center mt-4">
        No file loaded
      </p>
    );
  }

  const rows = [
    ["File", fileName],
    ["Duration", formatTime(buf.duration)],
    ["Sample Rate", `${buf.sampleRate.toLocaleString()} Hz`],
    ["Channels", buf.numberOfChannels === 1 ? "Mono" : "Stereo"],
    ["Samples", buf.length.toLocaleString()],
    ["Bit Depth", "16-bit (PCM)"],
  ];

  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border/50">
            <td className="py-1.5 text-text-muted pr-2">{label}</td>
            <td className="py-1.5 text-text-secondary text-right">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EffectsTab() {
  const engine = useAudioEngine();
  const ui = useUIStore();
  const hasBuffer = useEditorStore((s) => !!s.audioBuffer);

  return (
    <div className="space-y-3">
      <EffectSection title="Amplitude">
        <EffectBtn label="Gain / Volume" onClick={() => ui.setEffectDialog("gain")} disabled={!hasBuffer} />
        <EffectBtn label="Normalize" onClick={() => engine.normalizeEffect()} disabled={!hasBuffer} />
        <EffectBtn label="Fade In" onClick={() => ui.setEffectDialog("fadeIn")} disabled={!hasBuffer} />
        <EffectBtn label="Fade Out" onClick={() => ui.setEffectDialog("fadeOut")} disabled={!hasBuffer} />
        <EffectBtn label="Compressor" onClick={() => ui.setEffectDialog("compressor")} disabled={!hasBuffer} />
      </EffectSection>

      <EffectSection title="Filters">
        <EffectBtn label="Custom Filter" onClick={() => ui.setEffectDialog("filter")} disabled={!hasBuffer} />
        {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
          <EffectBtn
            key={key}
            label={preset.label}
            onClick={() => engine.filterEffect(preset.params)}
            disabled={!hasBuffer}
            small
          />
        ))}
      </EffectSection>

      <EffectSection title="Noise">
        <EffectBtn label="Get Noise Profile" onClick={() => ui.setEffectDialog("noiseProfile")} disabled={!hasBuffer} />
        <EffectBtn label="Noise Reduction" onClick={() => ui.setEffectDialog("noiseReduce")} disabled={!hasBuffer} />
      </EffectSection>

      <EffectSection title="Transform">
        <EffectBtn label="Reverse" onClick={() => engine.reverseEffect()} disabled={!hasBuffer} />
        <EffectBtn label="Invert (Phase Flip)" onClick={() => engine.invertEffect()} disabled={!hasBuffer} />
        <EffectBtn label="Remove DC Offset" onClick={() => engine.dcOffsetEffect()} disabled={!hasBuffer} />
        <EffectBtn label="Silence Selection" onClick={() => engine.silenceEffect()} disabled={!hasBuffer} />
      </EffectSection>

      <EffectSection title="Compressor Presets">
        {Object.entries(COMPRESSOR_PRESETS).map(([key, preset]) => (
          <EffectBtn
            key={key}
            label={preset.label}
            onClick={() => engine.compressorEffect(preset.params)}
            disabled={!hasBuffer}
            small
          />
        ))}
      </EffectSection>
    </div>
  );
}

function EffectSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EffectBtn({
  label,
  onClick,
  disabled,
  small,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center justify-between px-2 rounded text-left hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors ${
        small
          ? "py-1 text-[11px] text-text-muted"
          : "py-1.5 text-xs text-text-secondary"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      <ChevronRight size={10} className="opacity-40" />
    </button>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
