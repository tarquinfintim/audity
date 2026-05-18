import { cloneAudioBuffer } from "./gain";

export interface CompressorParams {
  threshold: number; // dB
  ratio: number;
  attack: number; // seconds
  release: number; // seconds
  knee: number; // dB
  makeupGain: number; // dB
}

export const COMPRESSOR_PRESETS: Record<
  string,
  { label: string; params: CompressorParams }
> = {
  gentle: {
    label: "Gentle Compression",
    params: {
      threshold: -20,
      ratio: 2,
      attack: 0.01,
      release: 0.25,
      knee: 10,
      makeupGain: 3,
    },
  },
  voiceLeveler: {
    label: "Voice Leveler",
    params: {
      threshold: -15,
      ratio: 4,
      attack: 0.003,
      release: 0.15,
      knee: 5,
      makeupGain: 6,
    },
  },
  limiter: {
    label: "Brick Wall Limiter",
    params: {
      threshold: -1,
      ratio: 20,
      attack: 0.001,
      release: 0.1,
      knee: 0,
      makeupGain: 0,
    },
  },
};

export async function applyCompressor(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  params: CompressorParams,
): Promise<AudioBuffer> {
  const regionLength = endSample - startSample;
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;

  // Extract region
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    regionLength,
    sampleRate,
  );
  const regionBuffer = offlineCtx.createBuffer(
    numChannels,
    regionLength,
    sampleRate,
  );
  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = regionBuffer.getChannelData(ch);
    for (let i = 0; i < regionLength; i++) {
      dst[i] = src[startSample + i]!;
    }
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = regionBuffer;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = params.threshold;
  compressor.ratio.value = params.ratio;
  compressor.attack.value = params.attack;
  compressor.release.value = params.release;
  compressor.knee.value = params.knee;

  const makeupGainNode = offlineCtx.createGain();
  makeupGainNode.gain.value = Math.pow(10, params.makeupGain / 20);

  source.connect(compressor);
  compressor.connect(makeupGainNode);
  makeupGainNode.connect(offlineCtx.destination);
  source.start();

  const processedRegion = await offlineCtx.startRendering();

  // Splice back
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
