import { create } from "zustand";
import {
  DEFAULT_SAMPLES_PER_PIXEL,
  MAX_VERTICAL_ZOOM,
  MIN_VERTICAL_ZOOM,
} from "@/lib/constants";

export interface Selection {
  start: number; // sample index
  end: number; // sample index
}

export interface Command {
  name: string;
  execute: () => void;
  undo: () => void;
}

interface EditorState {
  // Audio data
  audioBuffer: AudioBuffer | null;
  fileName: string;
  fileHandle: FileSystemFileHandle | null;
  sampleRate: number;
  duration: number;
  channelCount: number;
  modified: boolean;

  // Cursor & selection
  cursor: number; // sample index
  selection: Selection | null;

  // Zoom & scroll
  samplesPerPixel: number;
  scrollOffset: number; // sample offset of left edge of viewport
  verticalZoom: number; // Y-axis amplitude multiplier (1.0 = normal)

  // Clipboard
  clipboard: Float32Array[] | null;

  // Undo/Redo
  undoStack: Command[];
  redoStack: Command[];

  // Actions
  setAudioBuffer: (
    buffer: AudioBuffer,
    fileName: string,
    handle?: FileSystemFileHandle,
  ) => void;
  replaceAudioBuffer: (buffer: AudioBuffer) => void;
  setCursor: (sample: number) => void;
  setSelection: (sel: Selection | null) => void;
  setSamplesPerPixel: (spp: number) => void;
  setScrollOffset: (offset: number) => void;
  setVerticalZoom: (vz: number) => void;
  setClipboard: (data: Float32Array[] | null) => void;
  setModified: (v: boolean) => void;
  setFileHandle: (h: FileSystemFileHandle | null) => void;

  // Edit operations
  pushUndo: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;

  // Derived helpers
  getSelectionOrAll: () => Selection;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  audioBuffer: null,
  fileName: "",
  fileHandle: null,
  sampleRate: 44100,
  duration: 0,
  channelCount: 0,
  modified: false,

  cursor: 0,
  selection: null,

  samplesPerPixel: DEFAULT_SAMPLES_PER_PIXEL,
  scrollOffset: 0,
  verticalZoom: 1.0,

  clipboard: null,

  undoStack: [],
  redoStack: [],

  setAudioBuffer: (buffer, fileName, handle) =>
    set({
      audioBuffer: buffer,
      fileName,
      fileHandle: handle ?? null,
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
      channelCount: buffer.numberOfChannels,
      cursor: 0,
      selection: null,
      scrollOffset: 0,
      modified: false,
      undoStack: [],
      redoStack: [],
    }),

  replaceAudioBuffer: (buffer) =>
    set({
      audioBuffer: buffer,
      duration: buffer.duration,
      channelCount: buffer.numberOfChannels,
      modified: true,
    }),

  setCursor: (sample) => set({ cursor: Math.max(0, sample) }),
  setSelection: (sel) => set({ selection: sel }),
  setSamplesPerPixel: (spp) =>
    set({ samplesPerPixel: Math.max(1, Math.min(65536, spp)) }),
  setScrollOffset: (offset) => set({ scrollOffset: Math.max(0, Math.floor(offset)) }),
  setVerticalZoom: (vz) =>
    set({ verticalZoom: Math.max(MIN_VERTICAL_ZOOM, Math.min(MAX_VERTICAL_ZOOM, vz)) }),
  setClipboard: (data) => set({ clipboard: data }),
  setModified: (v) => set({ modified: v }),
  setFileHandle: (h) => set({ fileHandle: h }),

  pushUndo: (cmd) => {
    const { undoStack } = get();
    const newStack = [...undoStack, cmd].slice(-100); // max 100
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    const cmd = undoStack[undoStack.length - 1];
    if (!cmd) return;
    cmd.undo();
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cmd],
    });
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    const cmd = redoStack[redoStack.length - 1];
    if (!cmd) return;
    cmd.execute();
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cmd],
    });
  },

  getSelectionOrAll: () => {
    const { selection, audioBuffer } = get();
    if (selection) return selection;
    return { start: 0, end: audioBuffer?.length ?? 0 };
  },
}));
