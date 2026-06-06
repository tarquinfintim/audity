import { useState } from "react";
import { useUIStore, type EffectDialogType } from "@/store/uiStore";
import { useEditorStore } from "@/store/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import type { FilterType } from "@/engine/effects/filter";
import { FILTER_PRESETS } from "@/engine/effects/filter";
import { COMPRESSOR_PRESETS, type CompressorParams } from "@/engine/effects/compressor";
import type { FadeCurve } from "@/engine/effects/fade";
import { X } from "lucide-react";

export function EffectDialog() {
  const effectDialog = useUIStore((s) => s.effectDialog);
  const close = () => useUIStore.getState().setEffectDialog(null);

  if (!effectDialog) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xl bg-bg-elevated border-t border-x border-border rounded-t-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {getDialogTitle(effectDialog)}
          </h2>
          <button
            onClick={close}
            className="p-1 rounded hover:bg-bg-hover text-text-muted"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          {effectDialog === "gain" && <GainDialog onClose={close} />}
          {effectDialog === "fadeIn" && <FadeDialog type="in" onClose={close} />}
          {effectDialog === "fadeOut" && <FadeDialog type="out" onClose={close} />}
          {effectDialog === "filter" && <FilterDialog onClose={close} />}
          {effectDialog === "compressor" && <CompressorDialog onClose={close} />}
          {effectDialog === "noiseProfile" && <NoiseProfileDialog onClose={close} />}
          {effectDialog === "noiseReduce" && <NoiseReduceDialog onClose={close} />}
          {effectDialog === "export" && <ExportDialog onClose={close} />}
          {effectDialog === "normalize" && <NormalizeDialog onClose={close} />}
          {effectDialog === "adaptiveGate" && <AdaptiveGateDialog onClose={close} />}
        </div>
      </div>
    </div>
  );
}

function getDialogTitle(type: EffectDialogType): string {
  const map: Record<string, string> = {
    gain: "Gain / Volume",
    normalize: "Normalize",
    fadeIn: "Fade In",
    fadeOut: "Fade Out",
    filter: "Filter",
    compressor: "Compressor",
    noiseProfile: "Capture Noise Profile",
    noiseReduce: "Noise Reduction",
    adaptiveGate: "Adaptive Background Muting",
    export: "Export",
  };
  return map[type ?? ""] ?? "";
}

// ---- Individual Dialogs ----

function GainDialog({ onClose }: { onClose: () => void }) {
  const [db, setDb] = useState(0);
  const engine = useAudioEngine();

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Gain: {db > 0 ? "+" : ""}{db} dB
        </label>
        <input
          type="range"
          min={-40}
          max={20}
          step={0.5}
          value={db}
          onChange={(e) => setDb(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>-40 dB</span>
          <span>0 dB</span>
          <span>+20 dB</span>
        </div>
      </div>
      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          engine.gainEffect(db);
          onClose();
        }}
      />
    </div>
  );
}

function NormalizeDialog({ onClose }: { onClose: () => void }) {
  const [targetDb, setTargetDb] = useState(-0.1);
  const engine = useAudioEngine();

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Target Peak: {targetDb} dB
        </label>
        <input
          type="range"
          min={-12}
          max={0}
          step={0.1}
          value={targetDb}
          onChange={(e) => setTargetDb(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
      </div>
      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          engine.normalizeEffect(targetDb);
          onClose();
        }}
      />
    </div>
  );
}

function FadeDialog({ type, onClose }: { type: "in" | "out"; onClose: () => void }) {
  const [curve, setCurve] = useState<FadeCurve>("linear");
  const engine = useAudioEngine();

  const curves: FadeCurve[] = ["linear", "logarithmic", "exponential", "scurve"];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">Curve</label>
        <div className="flex gap-2">
          {curves.map((c) => (
            <button
              key={c}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                curve === c
                  ? "bg-accent text-white"
                  : "bg-bg-hover text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setCurve(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          if (type === "in") engine.fadeInEffect(curve);
          else engine.fadeOutEffect(curve);
          onClose();
        }}
      />
    </div>
  );
}

function FilterDialog({ onClose }: { onClose: () => void }) {
  const [filterType, setFilterType] = useState<FilterType>("lowpass");
  const [frequency, setFrequency] = useState(2000);
  const [q, setQ] = useState(0.7);
  const engine = useAudioEngine();

  const types: FilterType[] = ["lowpass", "highpass", "bandpass", "notch"];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">Type</label>
        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                filterType === t
                  ? "bg-accent text-white"
                  : "bg-bg-hover text-text-secondary"
              }`}
              onClick={() => setFilterType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Frequency: {frequency} Hz
        </label>
        <input
          type="range"
          min={20}
          max={20000}
          step={1}
          value={frequency}
          onChange={(e) => setFrequency(parseInt(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>20 Hz</span>
          <span>20 kHz</span>
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Q: {q.toFixed(1)}
        </label>
        <input
          type="range"
          min={0.1}
          max={20}
          step={0.1}
          value={q}
          onChange={(e) => setQ(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      {/* Presets */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Presets</label>
        <div className="flex flex-wrap gap-1">
          {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              className="px-2 py-1 rounded text-[11px] bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => {
                setFilterType(preset.params.type);
                setFrequency(preset.params.frequency);
                setQ(preset.params.Q);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          engine.filterEffect({ type: filterType, frequency, Q: q });
          onClose();
        }}
      />
    </div>
  );
}

function CompressorDialog({ onClose }: { onClose: () => void }) {
  const [params, setParams] = useState<CompressorParams>({
    threshold: -20,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
    knee: 10,
    makeupGain: 3,
  });
  const engine = useAudioEngine();

  const update = (key: keyof CompressorParams, val: number) =>
    setParams((p) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-3">
      <SliderRow
        label={`Threshold: ${params.threshold} dB`}
        min={-60}
        max={0}
        step={1}
        value={params.threshold}
        onChange={(v) => update("threshold", v)}
      />
      <SliderRow
        label={`Ratio: ${params.ratio}:1`}
        min={1}
        max={20}
        step={0.5}
        value={params.ratio}
        onChange={(v) => update("ratio", v)}
      />
      <SliderRow
        label={`Attack: ${params.attack}s`}
        min={0.001}
        max={0.1}
        step={0.001}
        value={params.attack}
        onChange={(v) => update("attack", v)}
      />
      <SliderRow
        label={`Release: ${params.release}s`}
        min={0.01}
        max={1}
        step={0.01}
        value={params.release}
        onChange={(v) => update("release", v)}
      />
      <SliderRow
        label={`Knee: ${params.knee} dB`}
        min={0}
        max={40}
        step={1}
        value={params.knee}
        onChange={(v) => update("knee", v)}
      />
      <SliderRow
        label={`Makeup Gain: ${params.makeupGain} dB`}
        min={0}
        max={24}
        step={0.5}
        value={params.makeupGain}
        onChange={(v) => update("makeupGain", v)}
      />

      <div>
        <label className="text-xs text-text-muted block mb-1">Presets</label>
        <div className="flex gap-2">
          {Object.entries(COMPRESSOR_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              className="px-2 py-1 rounded text-[11px] bg-bg-hover text-text-secondary hover:text-text-primary"
              onClick={() => setParams(preset.params)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          engine.compressorEffect(params);
          onClose();
        }}
      />
    </div>
  );
}

function NoiseProfileDialog({ onClose }: { onClose: () => void }) {
  const selection = useEditorStore((s) => s.selection);
  const audioBuffer = useEditorStore((s) => s.audioBuffer);

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Select a region that contains <strong>only noise</strong> (no desired
        audio), then click "Capture Profile". This profile will be used by
        Noise Reduction and Adaptive Background Muting.
      </p>
      {!selection && (
        <p className="text-xs text-danger">
          Please select a noise-only region first.
        </p>
      )}
      <DialogButtons
        onCancel={onClose}
        applyLabel="Capture Profile"
        applyDisabled={!selection || !audioBuffer}
        onApply={() => {
          if (!audioBuffer || !selection) return;
          // Store the noise region range — backend will extract it from the full audio
          (window as any).__audityNoiseRegion = {
            start: selection.start,
            end: selection.end,
          };
          useUIStore.getState().showToast("Noise profile captured");
          onClose();
        }}
      />
    </div>
  );
}

function NoiseReduceDialog({ onClose }: { onClose: () => void }) {
  const [strength, setStrength] = useState(60);
  const engine = useAudioEngine();
  const hasNoiseProfile = !!(window as any).__audityNoiseRegion;

  return (
    <div className="space-y-4">
      {!hasNoiseProfile && (
        <p className="text-xs text-danger">
          No noise profile captured. Use "Capture Noise Profile" first.
        </p>
      )}
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Reduction Strength: {strength}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={strength}
          onChange={(e) => setStrength(parseInt(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Light</span>
          <span>Medium</span>
          <span>Aggressive</span>
        </div>
      </div>
      <DialogButtons
        onCancel={onClose}
        applyDisabled={!hasNoiseProfile}
        onApply={() => {
          engine.noiseReductionEffect(strength / 100);
          onClose();
        }}
      />
    </div>
  );
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const engine = useAudioEngine();

  const formats = ["mp3", "ogg", "flac", "wav"];
  const bitrates = ["128k", "192k", "256k", "320k"];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">Format</label>
        <div className="flex gap-2">
          {formats.map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded text-xs uppercase transition-colors ${
                format === f
                  ? "bg-accent text-white"
                  : "bg-bg-hover text-text-secondary"
              }`}
              onClick={() => setFormat(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {(format === "mp3" || format === "ogg") && (
        <div>
          <label className="text-xs text-text-muted block mb-1">Bitrate</label>
          <div className="flex gap-2">
            {bitrates.map((b) => (
              <button
                key={b}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  bitrate === b
                    ? "bg-accent text-white"
                    : "bg-bg-hover text-text-secondary"
                }`}
                onClick={() => setBitrate(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}
      <DialogButtons
        onCancel={onClose}
        applyLabel="Export"
        onApply={() => {
          if (format === "wav") {
            // Save directly
            engine.saveCurrentFile();
          } else {
            engine.exportFile(format, bitrate);
          }
          onClose();
        }}
      />
    </div>
  );
}

// ---- Shared UI ----

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function DialogButtons({
  onCancel,
  onApply,
  applyLabel = "Apply",
  applyDisabled,
}: {
  onCancel: () => void;
  onApply: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        className="px-4 py-1.5 rounded text-xs bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
        onClick={onApply}
        disabled={applyDisabled}
      >
        {applyLabel}
      </button>
    </div>
  );
}

// ---- Adaptive Background Muting Dialog ----

function AdaptiveGateDialog({ onClose }: { onClose: () => void }) {
  const [thresholdMarginDb, setThresholdMarginDb] = useState(6);
  const [lookaheadMs, setLookaheadMs] = useState(30);
  const [attackMs, setAttackMs] = useState(5);
  const [holdMs, setHoldMs] = useState(100);
  const [releaseMs, setReleaseMs] = useState(50);
  const engine = useAudioEngine();

  const hasNoiseProfile = !!(window as any).__audityNoiseRegion;

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Good for nature recordings with no natural background noise. Silences audio that stays within the noise floor, with look-ahead to unmute before transients.
      </p>
      {!hasNoiseProfile && (
        <p className="text-xs text-yellow-400">
          Tip: Capture a noise profile first (select a quiet region → Effects → Noise Profile) for best results.
        </p>
      )}
      <div className="space-y-3">
        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Threshold Margin</span>
          <span className="text-text-muted">{thresholdMarginDb} dB above noise floor</span>
        </label>
        <input
          type="range"
          min={1}
          max={24}
          step={0.5}
          value={thresholdMarginDb}
          onChange={(e) => setThresholdMarginDb(Number(e.target.value))}
          className="w-full"
        />

        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Look-ahead</span>
          <span className="text-text-muted">{lookaheadMs} ms</span>
        </label>
        <input
          type="range"
          min={5}
          max={100}
          step={1}
          value={lookaheadMs}
          onChange={(e) => setLookaheadMs(Number(e.target.value))}
          className="w-full"
        />

        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Attack</span>
          <span className="text-text-muted">{attackMs} ms</span>
        </label>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={attackMs}
          onChange={(e) => setAttackMs(Number(e.target.value))}
          className="w-full"
        />

        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Hold</span>
          <span className="text-text-muted">{holdMs} ms</span>
        </label>
        <input
          type="range"
          min={10}
          max={500}
          step={5}
          value={holdMs}
          onChange={(e) => setHoldMs(Number(e.target.value))}
          className="w-full"
        />

        <label className="flex items-center justify-between text-xs text-text-secondary">
          <span>Release</span>
          <span className="text-text-muted">{releaseMs} ms</span>
        </label>
        <input
          type="range"
          min={10}
          max={200}
          step={5}
          value={releaseMs}
          onChange={(e) => setReleaseMs(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <DialogButtons
        onCancel={onClose}
        onApply={() => {
          engine.adaptiveGateEffect({
            thresholdMarginDb,
            lookaheadMs,
            attackMs,
            holdMs,
            releaseMs,
          });
          onClose();
        }}
      />
    </div>
  );
}
