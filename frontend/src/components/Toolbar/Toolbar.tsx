import { useEditorStore } from "@/store/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useUIStore } from "@/store/uiStore";
import {
  FolderOpen,
  Save,
  Download,
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  Undo2,
  Redo2,
  CropIcon,
  RefreshCw,
} from "lucide-react";

export function Toolbar() {
  const engine = useAudioEngine();
  const hasBuffer = useEditorStore((s) => !!s.audioBuffer);
  const hasSelection = useEditorStore((s) => !!s.selection);
  const hasClipboard = useEditorStore((s) => !!s.clipboard);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const resetZoom = () => {
    useEditorStore.getState().setSamplesPerPixel(256);
    useEditorStore.getState().setVerticalZoom(1);
  };
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const setEffectDialog = useUIStore((s) => s.setEffectDialog);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-bg-elevated border-b border-border">
      {/* File group */}
      <ToolGroup>
        <ToolBtn
          icon={<FolderOpen size={16} />}
          label="Open"
          shortcut="Ctrl+O"
          onClick={engine.loadFile}
        />
        <ToolBtn
          icon={<Save size={16} />}
          label="Save"
          shortcut="Ctrl+S"
          onClick={engine.saveCurrentFile}
          disabled={!hasBuffer}
        />
        <ToolBtn
          icon={<Download size={16} />}
          label="Export"
          shortcut="Ctrl+Shift+S"
          onClick={() => setEffectDialog("export")}
          disabled={!hasBuffer}
        />
      </ToolGroup>

      <ToolDivider />

      {/* Edit group */}
      <ToolGroup>
        <ToolBtn
          icon={<Scissors size={16} />}
          label="Cut"
          shortcut="Ctrl+X"
          onClick={engine.cut}
          disabled={!hasSelection}
        />
        <ToolBtn
          icon={<Copy size={16} />}
          label="Copy"
          shortcut="Ctrl+C"
          onClick={engine.copy}
          disabled={!hasSelection}
        />
        <ToolBtn
          icon={<ClipboardPaste size={16} />}
          label="Paste"
          shortcut="Ctrl+V"
          onClick={engine.paste}
          disabled={!hasClipboard}
        />
        <ToolBtn
          icon={<Trash2 size={16} />}
          label="Delete"
          shortcut="Del"
          onClick={engine.deleteSelection}
          disabled={!hasSelection}
        />
        <ToolBtn
          icon={<CropIcon size={16} />}
          label="Trim"
          shortcut="Ctrl+T"
          onClick={engine.trim}
          disabled={!hasSelection}
        />
      </ToolGroup>

      <ToolDivider />

      {/* Zoom */}
      <ToolGroup>
        <ToolBtn
          icon={<RefreshCw size={16} />}
          label="Reset Zoom"
          shortcut="Ctrl+0"
          onClick={resetZoom}
        />
      </ToolGroup>

      <ToolDivider />

      {/* Undo/Redo */}
      <ToolGroup>
        <ToolBtn
          icon={<Undo2 size={16} />}
          label="Undo"
          shortcut="Ctrl+Z"
          onClick={() => useEditorStore.getState().undo()}
          disabled={!canUndo}
        />
        <ToolBtn
          icon={<Redo2 size={16} />}
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          onClick={() => useEditorStore.getState().redo()}
          disabled={!canRedo}
        />
      </ToolGroup>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolDivider() {
  return <div className="w-px h-6 bg-border mx-1.5" />;
}

function ToolBtn({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
