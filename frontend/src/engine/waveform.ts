/**
 * Compute waveform peaks for rendering.
 * Returns min/max pairs for each pixel column at a given resolution.
 */

export interface PeakData {
  /** One min value per column */
  min: Float32Array;
  /** One max value per column */
  max: Float32Array;
  /** Samples per pixel used to generate these peaks */
  samplesPerPixel: number;
}

export function computePeaks(
  channelData: Float32Array,
  samplesPerPixel: number,
  startSample: number = 0,
  endSample?: number,
): PeakData {
  const start = Math.floor(startSample);
  const end = Math.min(endSample ?? channelData.length, channelData.length);
  const totalSamples = end - start;
  const numColumns = Math.max(0, Math.ceil(totalSamples / samplesPerPixel));

  const min = new Float32Array(numColumns);
  const max = new Float32Array(numColumns);

  for (let col = 0; col < numColumns; col++) {
    const blockStart = start + col * samplesPerPixel;
    const blockEnd = Math.min(blockStart + samplesPerPixel, end);

    let lo = 1.0;
    let hi = -1.0;

    for (let i = blockStart; i < blockEnd; i++) {
      const sample = channelData[i]!;
      if (sample < lo) lo = sample;
      if (sample > hi) hi = sample;
    }

    // If no valid samples found (lo > hi), set both to 0
    if (lo > hi) {
      lo = 0;
      hi = 0;
    }

    min[col] = lo;
    max[col] = hi;
  }

  return { min, max, samplesPerPixel };
}

/**
 * Multi-resolution peak cache. Pre-computes peaks at several zoom levels
 * for fast rendering.
 */
export class PeakCache {
  private cache = new Map<number, PeakData[]>();

  constructor(
    private buffer: AudioBuffer,
    private resolutions: number[] = [1, 4, 16, 64, 256, 1024, 4096, 16384],
  ) {}

  getPeaks(channel: number, samplesPerPixel: number): PeakData {
    // Find the best cached resolution (closest that divides evenly or is smaller)
    const channelData = this.buffer.getChannelData(channel);
    return computePeaks(channelData, samplesPerPixel);
  }

  precompute(): void {
    for (let ch = 0; ch < this.buffer.numberOfChannels; ch++) {
      const channelPeaks: PeakData[] = [];
      const data = this.buffer.getChannelData(ch);
      for (const res of this.resolutions) {
        channelPeaks.push(computePeaks(data, res));
      }
      this.cache.set(ch, channelPeaks);
    }
  }

  getCached(channel: number, samplesPerPixel: number): PeakData | null {
    const channelCache = this.cache.get(channel);
    if (!channelCache) return null;
    // Find best match
    let best: PeakData | null = null;
    for (const p of channelCache) {
      if (p.samplesPerPixel <= samplesPerPixel) {
        if (!best || p.samplesPerPixel > best.samplesPerPixel) {
          best = p;
        }
      }
    }
    return best;
  }
}
