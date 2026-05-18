import { getAudioContext } from "./audioContext";

export type PlaybackState = "stopped" | "playing" | "paused";

export class PlaybackEngine {
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private startTime = 0;
  private startOffset = 0;
  private _state: PlaybackState = "stopped";
  private _loop = false;
  private _loopStart = 0;
  private _loopEnd = 0;
  private onEndCallback: (() => void) | null = null;

  constructor(private ctx: AudioContext) {
    this.gainNode = ctx.createGain();
    this.gainNode.connect(ctx.destination);
  }

  get state(): PlaybackState {
    return this._state;
  }

  get loop(): boolean {
    return this._loop;
  }

  get loopStart(): number {
    return this._loopStart;
  }

  get loopEnd(): number {
    return this._loopEnd;
  }

  get currentTime(): number {
    if (this._state === "playing") {
      let t = this.startOffset + (this.ctx.currentTime - this.startTime);
      // When looping a selection, wrap the time back into the loop range
      if (this._loop && this._loopEnd > this._loopStart) {
        const loopLen = this._loopEnd - this._loopStart;
        if (t >= this._loopEnd) {
          t = this._loopStart + ((t - this._loopStart) % loopLen);
        }
      }
      return t;
    }
    return this.startOffset;
  }

  setVolume(value: number) {
    this.gainNode.gain.value = value;
  }

  play(
    buffer: AudioBuffer,
    offset: number = 0,
    selectionStart?: number,
    selectionEnd?: number,
    onEnd?: () => void,
  ) {
    this.stop();
    this.onEndCallback = onEnd ?? null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    if (this._loop && selectionStart !== undefined && selectionEnd !== undefined) {
      source.loop = true;
      source.loopStart = selectionStart;
      source.loopEnd = selectionEnd;
      this._loopStart = selectionStart;
      this._loopEnd = selectionEnd;
    } else if (this._loop) {
      // Loop the entire buffer
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      this._loopStart = 0;
      this._loopEnd = buffer.duration;
    } else {
      this._loopStart = 0;
      this._loopEnd = 0;
    }

    source.onended = () => {
      if (this._state === "playing") {
        this._state = "stopped";
        this.startOffset = 0;
        this.onEndCallback?.();
      }
    };

    const duration =
      !this._loop && selectionEnd !== undefined
        ? selectionEnd - offset
        : undefined;

    source.start(0, offset, duration);
    this.source = source;
    this.startTime = this.ctx.currentTime;
    this.startOffset = offset;
    this._state = "playing";
  }

  pause() {
    if (this._state !== "playing") return;
    this.startOffset = this.currentTime;
    this.source?.stop();
    this.source = null;
    this._state = "paused";
  }

  stop() {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source = null;
    }
    this._state = "stopped";
    this.startOffset = 0;
  }

  toggleLoop() {
    this._loop = !this._loop;
  }

  setLoop(value: boolean) {
    this._loop = value;
  }
}

let playbackEngine: PlaybackEngine | null = null;

export function getPlaybackEngine(): PlaybackEngine {
  if (!playbackEngine) {
    playbackEngine = new PlaybackEngine(getAudioContext());
  }
  return playbackEngine;
}
