/**
 * Client for backend DSP effects API.
 * Sends the full AudioBuffer as WAV, receives processed WAV back.
 */

import { encodeWav } from "@/engine/encoder";
import { decodeAudioFile } from "@/engine/decoder";

interface BackendEffectOptions {
  /** API endpoint path, e.g. "/api/effects/filter" */
  endpoint: string;
  /** The full audio buffer */
  buffer: AudioBuffer;
  /** Start sample of the region to process */
  startSample: number;
  /** End sample of the region to process */
  endSample: number;
  /** Additional form fields (parameters) */
  params: Record<string, string | number>;
  /** Optional noise profile audio (for noise-based effects) */
  noiseBuffer?: AudioBuffer;
  /** Optional noise profile region */
  noiseStart?: number;
  noiseEnd?: number;
}

export async function applyBackendEffect(opts: BackendEffectOptions): Promise<AudioBuffer> {
  const { endpoint, buffer, startSample, endSample, params, noiseBuffer, noiseStart, noiseEnd } = opts;

  // Encode full buffer as WAV
  const wavBlob = encodeWav(buffer);

  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("start_sample", String(startSample));
  formData.append("end_sample", String(endSample));

  // Add params
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }

  // If we have a noise profile region, encode and send it
  if (noiseBuffer && noiseStart !== undefined && noiseEnd !== undefined) {
    const noiseLength = noiseEnd - noiseStart;
    const offlineCtx = new OfflineAudioContext(
      noiseBuffer.numberOfChannels,
      noiseLength,
      noiseBuffer.sampleRate,
    );
    const noiseBuf = offlineCtx.createBuffer(
      noiseBuffer.numberOfChannels,
      noiseLength,
      noiseBuffer.sampleRate,
    );
    for (let ch = 0; ch < noiseBuffer.numberOfChannels; ch++) {
      const src = noiseBuffer.getChannelData(ch);
      const dst = noiseBuf.getChannelData(ch);
      for (let i = 0; i < noiseLength; i++) {
        dst[i] = src[noiseStart + i]!;
      }
    }
    const noiseWav = encodeWav(noiseBuf);
    formData.append("noise_file", noiseWav, "noise.wav");
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Backend effect failed (${resp.status}): ${text}`);
  }

  // Decode returned WAV into AudioBuffer
  const resultBlob = await resp.blob();
  const resultFile = new File([resultBlob], "result.wav", { type: "audio/wav" });
  return decodeAudioFile(resultFile);
}
