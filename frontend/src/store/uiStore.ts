import { create } from "zustand";

export type SidebarTab = "files" | "info" | "effects";
export type EffectDialogType =
  | null
  | "gain"
  | "normalize"
  | "fadeIn"
  | "fadeOut"
  | "filter"
  | "compressor"
  | "noiseProfile"
  | "noiseReduce"
  | "adaptiveGate"
  | "export";

interface UIState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  effectDialog: EffectDialogType;
  isProcessing: boolean;
  processingProgress: number; // 0–1, -1 = indeterminate
  toastMessage: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setEffectDialog: (d: EffectDialogType) => void;
  setProcessing: (v: boolean) => void;
  setProcessingProgress: (p: number) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  sidebarTab: "files",
  effectDialog: null,
  isProcessing: false,
  processingProgress: -1,
  toastMessage: null,

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSidebarTab: (tab) => set({ sidebarTab: tab, sidebarOpen: true }),
  setEffectDialog: (d) => set({ effectDialog: d }),
  setProcessing: (v) => set({ isProcessing: v, processingProgress: v ? -1 : -1 }),
  setProcessingProgress: (p) => set({ processingProgress: p }),
  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => set({ toastMessage: null }), 3000);
  },
  clearToast: () => set({ toastMessage: null }),
}));
