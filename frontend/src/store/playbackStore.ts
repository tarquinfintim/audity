import { create } from "zustand";

interface PlaybackState {
  isPlaying: boolean;
  isLooping: boolean;
  playbackPosition: number; // seconds
  volume: number; // 0-1

  setPlaying: (v: boolean) => void;
  setLooping: (v: boolean) => void;
  toggleLooping: () => void;
  setPlaybackPosition: (pos: number) => void;
  setVolume: (v: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  isLooping: false,
  playbackPosition: 0,
  volume: 1,

  setPlaying: (v) => set({ isPlaying: v }),
  setLooping: (v) => set({ isLooping: v }),
  toggleLooping: () => set({ isLooping: !get().isLooping }),
  setPlaybackPosition: (pos) => set({ playbackPosition: pos }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
}));
