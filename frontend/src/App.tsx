import { MenuBar } from "@/components/MenuBar";
import { Toolbar } from "@/components/Toolbar";
import { WaveformOverview } from "@/components/WaveformOverview";
import { TimeRuler } from "@/components/TimeRuler";
import { WaveformEditor } from "@/components/WaveformEditor";
import { TransportBar } from "@/components/TransportBar";
import { StatusBar } from "@/components/StatusBar";
import { SidePanel } from "@/components/SidePanel";
import { EffectDialog } from "@/components/EffectDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUIStore } from "@/store/uiStore";

export default function App() {
  useKeyboardShortcuts();

  const isProcessing = useUIStore((s) => s.isProcessing);
  const processingProgress = useUIStore((s) => s.processingProgress);
  const toastMessage = useUIStore((s) => s.toastMessage);

  return (
    <div className="h-screen flex flex-col bg-bg-deep text-text-primary overflow-hidden">
      <MenuBar />
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <WaveformOverview />
          <TimeRuler />
          <WaveformEditor />
        </div>

        {/* Side panel */}
        <SidePanel />
      </div>

      <TransportBar />
      <StatusBar />

      {/* Modals */}
      <EffectDialog />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-bg-elevated px-6 py-4 rounded-lg border border-border shadow-xl min-w-[260px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">
                {processingProgress >= 0
                  ? `Processing... ${Math.round(processingProgress * 100)}%`
                  : "Processing..."}
              </span>
            </div>
            {processingProgress >= 0 && (
              <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-[width] duration-150"
                  style={{ width: `${Math.round(processingProgress * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-bg-elevated border border-border px-4 py-2 rounded-lg shadow-xl text-sm text-text-secondary animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
