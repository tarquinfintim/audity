import { cloneAudioBuffer } from "./gain";

export type FadeCurve = "linear" | "logarithmic" | "exponential" | "scurve";

export async function applyFadeIn(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  curve: FadeCurve = "linear",
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);
  const fadeLength = endSample - startSample;

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / fadeLength;
      data[i]! *= getCurveValue(t, curve);
    }
  }

  return newBuffer;
}

export async function applyFadeOut(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  curve: FadeCurve = "linear",
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);
  const fadeLength = endSample - startSample;

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / fadeLength;
      data[i]! *= getCurveValue(1 - t, curve);
    }
  }

  return newBuffer;
}

function getCurveValue(t: number, curve: FadeCurve): number {
  switch (curve) {
    case "linear":
      return t;
    case "logarithmic":
      return Math.log10(1 + 9 * t);
    case "exponential":
      return t * t;
    case "scurve":
      return t * t * (3 - 2 * t);
  }
}
