export const MIN_SAMPLES_PER_PIXEL = 1;
export const MAX_SAMPLES_PER_PIXEL = 65536;
export const DEFAULT_SAMPLES_PER_PIXEL = 256;
export const MIN_VERTICAL_ZOOM = 0.25;
export const MAX_VERTICAL_ZOOM = 64;

export const WAVEFORM_HEIGHT = 300;
export const OVERVIEW_HEIGHT = 48;
export const TIME_RULER_HEIGHT = 24;

export const MAX_UNDO_STEPS = 100;

export const SUPPORTED_INPUT_FORMATS = [".wav"];
export const SUPPORTED_OUTPUT_FORMATS = ["mp3", "ogg", "flac", "wav"] as const;
export type OutputFormat = (typeof SUPPORTED_OUTPUT_FORMATS)[number];

export const CURSOR_NUDGE_SAMPLES = 441; // ~10ms at 44.1kHz
export const CURSOR_NUDGE_LARGE = 4410; // ~100ms at 44.1kHz
