export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const ms = Math.round((secs - whole) * 1000);
  return `${mins.toString().padStart(2, "0")}:${whole.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function formatSamples(samples: number, sampleRate: number): string {
  return formatTime(samples / sampleRate);
}

export function samplesToTime(samples: number, sampleRate: number): number {
  return samples / sampleRate;
}

export function timeToSamples(time: number, sampleRate: number): number {
  return Math.round(time * sampleRate);
}
