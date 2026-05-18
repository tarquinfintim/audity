/**
 * Apply gain (volume) adjustment to audio data.
 */
export async function applyGain(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  gainDb: number,
): Promise<AudioBuffer> {
  const gainLinear = Math.pow(10, gainDb / 20);
  const newBuffer = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    const data = newBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      data[i]! *= gainLinear;
    }
  }

  return newBuffer;
}

/**
 * Peak normalize audio.
 */
export async function applyNormalize(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
  targetDb: number = -0.1,
): Promise<AudioBuffer> {
  const targetLinear = Math.pow(10, targetDb / 20);

  // Find peak
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      const abs = Math.abs(data[i]!);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0) return cloneAudioBuffer(buffer);

  const gain = targetLinear / peak;
  return applyGain(buffer, startSample, endSample, 20 * Math.log10(gain));
}

function cloneAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const newBuffer = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    newBuffer.getChannelData(ch).set(buffer.getChannelData(ch));
  }
  return newBuffer;
}

export { cloneAudioBuffer };
