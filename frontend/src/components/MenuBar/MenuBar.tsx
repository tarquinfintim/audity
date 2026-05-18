import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useEditorStore } from "@/store/editorStore";
import { useUIStore } from "@/store/uiStore";

export function MenuBar() {
  const engine = useAudioEngine();
  const hasBuffer = useEditorStore((s) => !!s.audioBuffer);
  const hasSelection = useEditorStore((s) => !!s.selection);
  const ui = useUIStore();

  return (
    <div className="flex items-center gap-0 px-1 py-0.5 bg-bg-elevated border-b border-border text-xs select-none">
      <MenuDropdown label="File">
        <MenuItem label="Open..." shortcut="Ctrl+O" onClick={engine.loadFile} />
        <MenuItem
          label="Save"
          shortcut="Ctrl+S"
          onClick={engine.saveCurrentFile}
          disabled={!hasBuffer}
        />
        <MenuItem
          label="Save As..."
          shortcut="Ctrl+Shift+S"
          onClick={engine.saveAs}
          disabled={!hasBuffer}
        />
        <MenuSep />
        <MenuItem
          label="Export..."
          onClick={() => ui.setEffectDialog("export")}
          disabled={!hasBuffer}
        />
      </MenuDropdown>

      <MenuDropdown label="Edit">
        <MenuItem
          label="Undo"
          shortcut="Ctrl+Z"
          onClick={() => useEditorStore.getState().undo()}
        />
        <MenuItem
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          onClick={() => useEditorStore.getState().redo()}
        />
        <MenuSep />
        <MenuItem label="Cut" shortcut="Ctrl+X" onClick={engine.cut} disabled={!hasSelection} />
        <MenuItem label="Copy" shortcut="Ctrl+C" onClick={engine.copy} disabled={!hasSelection} />
        <MenuItem label="Paste" shortcut="Ctrl+V" onClick={engine.paste} />
        <MenuItem
          label="Delete"
          shortcut="Del"
          onClick={engine.deleteSelection}
          disabled={!hasSelection}
        />
        <MenuSep />
        <MenuItem
          label="Trim to Selection"
          shortcut="Ctrl+T"
          onClick={engine.trim}
          disabled={!hasSelection}
        />
        <MenuItem
          label="Silence Selection"
          onClick={engine.silenceEffect}
          disabled={!hasSelection}
        />
        <MenuSep />
        <MenuItem
          label="Select All"
          shortcut="Ctrl+A"
          onClick={() => {
            const buf = useEditorStore.getState().audioBuffer;
            if (buf) useEditorStore.getState().setSelection({ start: 0, end: buf.length });
          }}
        />
      </MenuDropdown>

      <MenuDropdown label="Effects">
        <MenuItem label="Gain / Volume..." shortcut="G" onClick={() => ui.setEffectDialog("gain")} disabled={!hasBuffer} />
        <MenuItem label="Normalize" shortcut="N" onClick={engine.normalizeEffect} disabled={!hasBuffer} />
        <MenuItem label="Fade In..." shortcut="F" onClick={() => ui.setEffectDialog("fadeIn")} disabled={!hasBuffer} />
        <MenuItem label="Fade Out..." shortcut="Shift+F" onClick={() => ui.setEffectDialog("fadeOut")} disabled={!hasBuffer} />
        <MenuSep />
        <MenuItem label="Filter..." shortcut="Ctrl+F" onClick={() => ui.setEffectDialog("filter")} disabled={!hasBuffer} />
        <MenuItem label="Compressor..." onClick={() => ui.setEffectDialog("compressor")} disabled={!hasBuffer} />
        <MenuSep />
        <MenuItem label="Reverse" onClick={engine.reverseEffect} disabled={!hasBuffer} />
        <MenuItem label="Invert (Phase Flip)" onClick={engine.invertEffect} disabled={!hasBuffer} />
        <MenuItem label="Remove DC Offset" onClick={engine.dcOffsetEffect} disabled={!hasBuffer} />
        <MenuSep />
        <MenuItem label="Noise Profile..." onClick={() => ui.setEffectDialog("noiseProfile")} disabled={!hasBuffer} />
        <MenuItem label="Noise Reduction..." onClick={() => ui.setEffectDialog("noiseReduce")} disabled={!hasBuffer} />
        <MenuItem label="Adaptive Background Muting..." onClick={() => ui.setEffectDialog("adaptiveGate")} disabled={!hasBuffer} />
      </MenuDropdown>

      <MenuDropdown label="View">
        <MenuItem
          label="Toggle Sidebar"
          shortcut="Tab"
          onClick={ui.toggleSidebar}
        />
      </MenuDropdown>

      <div className="flex-1" />
      <span className="text-text-muted px-3 font-semibold tracking-wide">
        AUDITY
      </span>
    </div>
  );
}

function MenuDropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors">
        {label}
      </button>
      <div className="absolute left-0 top-full mt-0.5 hidden group-focus-within:block hover:block min-w-[220px] bg-bg-elevated border border-border rounded-md shadow-xl z-50 py-1">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="text-text-muted text-[10px] ml-4">{shortcut}</span>
      )}
    </button>
  );
}

function MenuSep() {
  return <div className="h-px bg-border my-1 mx-2" />;
}
