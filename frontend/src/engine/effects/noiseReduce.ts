import { cloneAudioBuffer } from "./gain";

/**
 * Spectral noise reduction using radix-2 FFT, overlap-add with Hann windowing,
 * and Wiener filtering (power spectral subtraction with spectral floor).
 */

export interface NoiseProfile {
  /** Average power spectrum (magnitude²) of the noise per channel */
  powerSpectrum: Float32Array[];
  fftSize: number;
  sampleRate: number;
}

// ---- Radix-2 Cooley-Tukey FFT ----

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  // FFT butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const a = i + j;
        const b = a + halfLen;
        const tRe = curRe * re[b]! - curIm * im[b]!;
        const tIm = curRe * im[b]! + curIm * re[b]!;
        re[b] = re[a]! - tRe;
        im[b] = im[a]! - tIm;
        re[a] = re[a]! + tRe;
        im[a] = im[a]! + tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

function ifft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // Conjugate
  for (let i = 0; i < n; i++) im[i] = -im[i]!;
  fft(re, im);
  // Conjugate and scale
  for (let i = 0; i < n; i++) {
    re[i] = re[i]! / n;
    im[i] = -im[i]! / n;
  }
}

function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

/**
 * Capture a noise profile from a region that contains only noise.
 * Computes the average power spectrum using overlapping Hann-windowed frames.
 */
export function captureNoiseProfile(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  fftSize: number = 2048,
): NoiseProfile {
  const hopSize = fftSize >> 1; // 50% overlap
  const window = hannWindow(fftSize);
  const profiles: Float32Array[] = [];

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const avgPower = new Float32Array(fftSize);
    let numFrames = 0;

    for (let pos = startSample; pos + fftSize <= endSample; pos += hopSize) {
      const re = new Float32Array(fftSize);
      const im = new Float32Array(fftSize);

      for (let i = 0; i < fftSize; i++) {
        re[i] = (data[pos + i] ?? 0) * window[i]!;
      }

      fft(re, im);

      for (let k = 0; k < fftSize; k++) {
        avgPower[k] += re[k]! * re[k]! + im[k]! * im[k]!;
      }
      numFrames++;
    }

    if (numFrames > 0) {
      for (let k = 0; k < fftSize; k++) avgPower[k] /= numFrames;
    }

    profiles.push(avgPower);
  }

  return {
    powerSpectrum: profiles,
    fftSize,
    sampleRate: buffer.sampleRate,
  };
}

/**
 * Apply noise reduction using overlap-add with Wiener filtering.
 *
 * For each frame:
 *   gain[k] = max(floor, 1 - strength * noisePower[k] / signalPower[k])
 *
 * This is superior to basic spectral subtraction because it:
 * - Preserves phase (multiplies magnitude, doesn't subtract)
 * - Has a spectral floor to prevent "musical noise" artifacts
 * - Uses overlap-add with Hann window for seamless reconstruction
 */
export async function applyNoiseReduction(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  profile: NoiseProfile,
  strength: number = 0.6,
  onProgress?: (progress: number) => void,
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);
  const { fftSize } = profile;
  const hopSize = fftSize >> 1;
  const window = hannWindow(fftSize);
  const regionLength = endSample - startSample;
  const totalFrames = Math.max(1, Math.floor((regionLength - fftSize) / hopSize) + 1);
  const totalWork = newBuffer.numberOfChannels * totalFrames;
  let workDone = 0;

  // Spectral floor: prevents gain from going to zero → avoids "musical noise"
  const floor = 0.02;

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    const noisePower = profile.powerSpectrum[ch];
    if (!noisePower) continue;

    // Output accumulator for overlap-add
    const output = new Float32Array(regionLength);
    const windowSum = new Float32Array(regionLength);

    for (let pos = startSample; pos + fftSize <= endSample; pos += hopSize) {
      const localPos = pos - startSample;
      const re = new Float32Array(fftSize);
      const im = new Float32Array(fftSize);

      // Windowed analysis
      for (let i = 0; i < fftSize; i++) {
        re[i] = (data[pos + i] ?? 0) * window[i]!;
      }

      fft(re, im);

      // Wiener filter gain
      for (let k = 0; k < fftSize; k++) {
        const signalPower = re[k]! * re[k]! + im[k]! * im[k]!;
        const noise = noisePower[k]! * strength;
        // Wiener gain: SNR-based attenuation with spectral floor
        const gain = signalPower > 0
          ? Math.max(floor, 1 - noise / signalPower)
          : floor;
        re[k] = re[k]! * gain;
        im[k] = im[k]! * gain;
      }

      ifft(re, im);

      // Overlap-add with synthesis window
      for (let i = 0; i < fftSize; i++) {
        output[localPos + i] += re[i]! * window[i]!;
        windowSum[localPos + i] += window[i]! * window[i]!;
      }

      workDone++;
      if (workDone % 32 === 0) {
        onProgress?.(workDone / totalWork);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Normalize by window sum and write back
    for (let i = 0; i < regionLength; i++) {
      if (windowSum[i]! > 1e-8) {
        data[startSample + i] = output[i]! / windowSum[i]!;
      }
    }
  }

  onProgress?.(1);
  return newBuffer;
}
