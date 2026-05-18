import { cloneAudioBuffer } from "./gain";

export async function applyReverse(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    const regionLength = endSample - startSample;
    for (let i = 0; i < Math.floor(regionLength / 2); i++) {
      const a = startSample + i;
      const b = endSample - 1 - i;
      const tmp = data[a]!;
      data[a] = data[b]!;
      data[b] = tmp;
    }
  }

  return newBuffer;
}

export async function applyInvert(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      data[i]! *= -1;
    }
  }

  return newBuffer;
}

export async function applyDcOffsetRemoval(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    let sum = 0;
    for (let i = startSample; i < endSample; i++) {
      sum += data[i]!;
    }
    const mean = sum / (endSample - startSample);
    for (let i = startSample; i < endSample; i++) {
      data[i]! -= mean;
    }
  }

  return newBuffer;
}

export async function applySilence(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
): Promise<AudioBuffer> {
  const newBuffer = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      data[i] = 0;
    }
  }

  return newBuffer;
}
