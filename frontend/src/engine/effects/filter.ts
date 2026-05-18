import { cloneAudioBuffer } from "./gain";

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch";

export interface FilterParams {
  type: FilterType;
  frequency: number;
  Q: number;
}

/**
 * Apply a biquad filter to a region of audio using OfflineAudioContext.
 */
export async function applyFilter(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  params: FilterParams,
): Promise<AudioBuffer> {
  const regionLength = endSample - startSample;
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;

  // Create a buffer for just the selected region
  const regionBuffer = new OfflineAudioContext(
    numChannels,
    regionLength,
    sampleRate,
  ).createBuffer(numChannels, regionLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = regionBuffer.getChannelData(ch);
    for (let i = 0; i < regionLength; i++) {
      dst[i] = src[startSample + i]!;
    }
  }

  // Process through filter
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    regionLength,
    sampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = regionBuffer;

  const filter = offlineCtx.createBiquadFilter();
  filter.type = params.type;
  filter.frequency.value = params.frequency;
  filter.Q.value = params.Q;

  source.connect(filter);
  filter.connect(offlineCtx.destination);
  source.start();

  const processedRegion = await offlineCtx.startRendering();

  // Splice back into full buffer
  const newBuffer = cloneAudioBuffer(buffer);
  for (let ch = 0; ch < numChannels; ch++) {
    const dst = newBuffer.getChannelData(ch);
    const processed = processedRegion.getChannelData(ch);
    for (let i = 0; i < regionLength; i++) {
      dst[startSample + i] = processed[i]!;
    }
  }

  return newBuffer;
}

// Presets
export const FILTER_PRESETS: Record<
  string,
  { label: string; params: FilterParams }
> = {
  removeHiss: {
    label: "Remove Hiss",
    params: { type: "lowpass", frequency: 6000, Q: 0.7 },
  },
  warmTone: {
    label: "Warm Tone",
    params: { type: "lowpass", frequency: 3000, Q: 1.0 },
  },
  telephone: {
    label: "Telephone Effect",
    params: { type: "lowpass", frequency: 3400, Q: 0.5 },
  },
  removeRumble: {
    label: "Remove Rumble",
    params: { type: "highpass", frequency: 80, Q: 0.7 },
  },
  removeHum50: {
    label: "Remove 50Hz Hum",
    params: { type: "notch", frequency: 50, Q: 30 },
  },
  removeHum60: {
    label: "Remove 60Hz Hum",
    params: { type: "notch", frequency: 60, Q: 30 },
  },
  voiceClarity: {
    label: "Voice Clarity",
    params: { type: "highpass", frequency: 120, Q: 0.7 },
  },
  voiceBand: {
    label: "Voice Band",
    params: { type: "bandpass", frequency: 1000, Q: 0.5 },
  },
};
