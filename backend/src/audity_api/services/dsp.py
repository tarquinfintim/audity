"""
Backend DSP effects using numpy/scipy/noisereduce.
All functions accept raw audio as numpy arrays and return processed arrays.
"""

import numpy as np
import noisereduce as nr
from numpy.typing import NDArray
from scipy.signal import butter, sosfilt, sosfiltfilt


def apply_filter(
    samples: NDArray[np.float32],
    sample_rate: int,
    filter_type: str,
    frequency: float,
    q: float = 0.707,
    order: int = 4,
) -> NDArray[np.float32]:
    """Apply a biquad filter using scipy butterworth design."""
    nyquist = sample_rate / 2

    if filter_type == "lowpass":
        sos = butter(order, frequency / nyquist, btype="low", output="sos")
    elif filter_type == "highpass":
        sos = butter(order, frequency / nyquist, btype="high", output="sos")
    elif filter_type == "bandpass":
        # Bandwidth from Q
        bw = frequency / q
        low = max(1, (frequency - bw / 2)) / nyquist
        high = min(nyquist - 1, (frequency + bw / 2)) / nyquist
        sos = butter(order, [low, high], btype="band", output="sos")
    elif filter_type == "notch":
        bw = frequency / q
        low = max(1, (frequency - bw / 2)) / nyquist
        high = min(nyquist - 1, (frequency + bw / 2)) / nyquist
        sos = butter(order, [low, high], btype="bandstop", output="sos")
    else:
        raise ValueError(f"Unknown filter type: {filter_type}")

    # Use filtfilt for zero-phase filtering (no time shift)
    if samples.ndim == 1:
        return sosfiltfilt(sos, samples).astype(np.float32)
    else:
        result = np.empty_like(samples)
        for ch in range(samples.shape[0]):
            result[ch] = sosfiltfilt(sos, samples[ch]).astype(np.float32)
        return result


def apply_noise_reduction(
    samples: NDArray[np.float32],
    sample_rate: int,
    noise_profile: NDArray[np.float32] | None = None,
    strength: float = 0.6,
) -> NDArray[np.float32]:
    """
    Noise reduction using the noisereduce library (stationary noise).
    If noise_profile is provided, uses it as the noise clip.
    Otherwise, uses automatic noise estimation.
    """
    # noisereduce expects (channels, samples) or (samples,)
    prop_decrease = np.clip(strength, 0.0, 1.0)

    if samples.ndim == 1:
        result = nr.reduce_noise(
            y=samples,
            sr=sample_rate,
            y_noise=noise_profile,
            prop_decrease=prop_decrease,
            stationary=True,
        )
        return result.astype(np.float32)
    else:
        result = np.empty_like(samples)
        for ch in range(samples.shape[0]):
            noise_ch = noise_profile[ch] if noise_profile is not None else None
            result[ch] = nr.reduce_noise(
                y=samples[ch],
                sr=sample_rate,
                y_noise=noise_ch,
                prop_decrease=prop_decrease,
                stationary=True,
            ).astype(np.float32)
        return result


def apply_compressor(
    samples: NDArray[np.float32],
    sample_rate: int,
    threshold_db: float = -20,
    ratio: float = 4,
    attack: float = 0.01,
    release: float = 0.25,
    knee_db: float = 10,
    makeup_gain_db: float = 0,
) -> NDArray[np.float32]:
    """Dynamic range compressor using envelope following."""
    threshold = 10 ** (threshold_db / 20)
    knee = 10 ** (knee_db / 20)
    makeup_gain = 10 ** (makeup_gain_db / 20)

    attack_coeff = np.exp(-1.0 / (sample_rate * attack))
    release_coeff = np.exp(-1.0 / (sample_rate * release))

    def compress_channel(data: NDArray[np.float32]) -> NDArray[np.float32]:
        output = np.empty_like(data)
        envelope = 0.0

        for i in range(len(data)):
            level = abs(data[i])

            # Envelope follower
            if level > envelope:
                envelope = attack_coeff * envelope + (1 - attack_coeff) * level
            else:
                envelope = release_coeff * envelope + (1 - release_coeff) * level

            # Gain computation with soft knee
            if envelope <= threshold - knee / 2:
                gain = 1.0
            elif envelope >= threshold + knee / 2:
                over_db = 20 * np.log10(max(envelope, 1e-10) / threshold)
                gain_reduction_db = over_db * (1 - 1 / ratio)
                gain = 10 ** (-gain_reduction_db / 20)
            else:
                # Soft knee interpolation
                x = (envelope - (threshold - knee / 2)) / knee
                gain = 1.0 - x * x * (1 - 1 / ratio) * 0.5

            output[i] = data[i] * gain * makeup_gain

        return output

    if samples.ndim == 1:
        return compress_channel(samples)
    else:
        result = np.empty_like(samples)
        for ch in range(samples.shape[0]):
            result[ch] = compress_channel(samples[ch])
        return result


def apply_adaptive_gate(
    samples: NDArray[np.float32],
    sample_rate: int,
    noise_profile: NDArray[np.float32] | None = None,
    threshold_margin_db: float = 6.0,
    lookahead_ms: float = 30.0,
    attack_ms: float = 5.0,
    hold_ms: float = 100.0,
    release_ms: float = 50.0,
) -> NDArray[np.float32]:
    """
    Adaptive Background Muting — a noise gate with look-ahead.

    Algorithm:
    1. Determine noise floor from the noise_profile (RMS of noise region)
       or auto-detect from the quietest 10% of short frames.
    2. Threshold = noise_floor_rms * margin (e.g., +6dB above noise floor)
    3. Scan audio with look-ahead window:
       - If any sample in the look-ahead window exceeds threshold → open gate
       - Gate opens with attack_ms fade-in
       - Gate holds open for hold_ms after signal drops below threshold
       - Gate closes with release_ms fade-out

    The look-ahead ensures the gate opens BEFORE the transient arrives,
    preserving the natural attack of sounds.
    """
    import logging
    logger = logging.getLogger(__name__)

    lookahead_samples = int(sample_rate * lookahead_ms / 1000)
    attack_samples = max(1, int(sample_rate * attack_ms / 1000))
    hold_samples = int(sample_rate * hold_ms / 1000)
    release_samples = max(1, int(sample_rate * release_ms / 1000))

    def compute_noise_floor(noise: NDArray[np.float32]) -> float:
        """
        Compute noise floor as the 95th percentile of absolute peak values
        in short frames. This matches the peak-based trigger comparison.
        """
        flat = noise.flatten() if noise.ndim > 1 else noise
        frame_size = int(sample_rate * 0.02)  # 20ms frames
        n_frames = max(1, len(flat) // frame_size)
        frame_peaks = np.array([
            np.max(np.abs(flat[i * frame_size:(i + 1) * frame_size]))
            for i in range(n_frames)
        ])
        # 95th percentile of frame peaks = typical peak level of noise
        return float(np.percentile(frame_peaks, 95))

    def auto_estimate_noise_floor(data: NDArray[np.float32]) -> float:
        """
        Auto-estimate noise floor by finding the peak level of the quietest
        10% of short analysis frames (50ms windows).
        """
        flat = data.flatten() if data.ndim > 1 else data
        frame_size = int(sample_rate * 0.05)  # 50ms frames
        n_frames = max(1, len(flat) // frame_size)
        frame_peaks = np.array([
            np.max(np.abs(flat[i * frame_size:(i + 1) * frame_size]))
            for i in range(n_frames)
        ])
        # Use the 10th percentile of frame peaks as noise floor
        noise_floor = float(np.percentile(frame_peaks, 10))
        return max(noise_floor, 1e-7)  # Prevent zero

    def gate_channel(
        data: NDArray[np.float32],
        noise_floor: float,
    ) -> NDArray[np.float32]:
        n = len(data)
        threshold = noise_floor * (10 ** (threshold_margin_db / 20))

        logger.info("    Gate channel: noise_floor=%.6f (%.1f dBFS), threshold=%.6f (%.1f dBFS), margin=%.1f dB",
                    noise_floor, 20 * np.log10(max(noise_floor, 1e-10)),
                    threshold, 20 * np.log10(max(threshold, 1e-10)),
                    threshold_margin_db)

        # Compute per-sample absolute amplitude
        amp = np.abs(data)

        # Determine gate trigger using rolling max for efficiency
        # trigger[i] = True if max(amp[i:i+lookahead]) > threshold
        trigger = np.zeros(n, dtype=np.bool_)

        # Use a sliding window max via cumulative max from the right
        # Process in chunks for memory efficiency
        max_buf = np.zeros(n, dtype=np.float32)
        # Scan right to left: max_buf[i] = max of amp[i:i+lookahead_samples]
        running_max = 0.0
        for i in range(n - 1, -1, -1):
            if i + lookahead_samples < n:
                # Simple approach: maintain running max isn't trivial going backward
                # Use a vectorized approach instead
                pass
            break  # Exit the naive loop

        # Vectorized rolling max: use scipy or a strided approach
        # For large arrays, compute max in blocks
        from scipy.ndimage import maximum_filter1d
        rolling_max = maximum_filter1d(amp, size=lookahead_samples, origin=-(lookahead_samples // 2))
        # maximum_filter1d with origin shifts the window. We want max of [i, i+lookahead)
        # Actually use a manual forward-looking approach with vectorization:
        # Shift amp left and compute cumulative max
        # Simpler: rolling_max[i] = max(amp[i:i+lookahead_samples])
        # Using maximum_filter1d with mode='constant' and proper origin
        padded = np.pad(amp, (0, lookahead_samples), mode='constant', constant_values=0)
        # Rolling max over window of size lookahead_samples starting at current position
        rolling_max = maximum_filter1d(padded, size=lookahead_samples, origin=0)[:n]

        trigger = rolling_max > threshold

        triggered_count = int(np.sum(trigger))
        logger.info("    Trigger: %d/%d samples above threshold (%.1f%%)",
                    triggered_count, n, 100.0 * triggered_count / n if n > 0 else 0)

        # Convert trigger to gate envelope (attack/hold/release)
        gate = np.zeros(n, dtype=np.float32)
        state = 0.0  # 0 = closed, 1 = open
        hold_counter = 0
        gate_open = False  # Track transitions for logging
        regions: list[tuple[str, float, float]] = []  # (type, start_sec, end_sec)
        region_start = 0.0

        for i in range(n):
            if trigger[i]:
                hold_counter = hold_samples
                # Attack: ramp up
                state = min(1.0, state + 1.0 / attack_samples)
            else:
                if hold_counter > 0:
                    hold_counter -= 1
                    state = min(1.0, state + 1.0 / attack_samples)
                else:
                    # Release: ramp down
                    state = max(0.0, state - 1.0 / release_samples)

            gate[i] = state

            # Log transitions
            currently_open = state > 0.5
            if currently_open and not gate_open:
                # Gate just opened (unmuted)
                if i > 0:
                    regions.append(("MUTED", region_start, i / sample_rate))
                region_start = i / sample_rate
                gate_open = True
            elif not currently_open and gate_open:
                # Gate just closed (muted)
                regions.append(("UNMUTED", region_start, i / sample_rate))
                region_start = i / sample_rate
                gate_open = False

        # Close final region
        final_time = n / sample_rate
        if gate_open:
            regions.append(("UNMUTED", region_start, final_time))
        else:
            regions.append(("MUTED", region_start, final_time))

        gate_open_pct = 100.0 * np.mean(gate > 0.5)
        logger.info("    Gate open %.1f%% of the time, %d transitions", gate_open_pct, len(regions))
        logger.info("    Regions (state | start → end | duration):")
        for rtype, rstart, rend in regions:
            duration = rend - rstart
            if duration >= 0.001:  # Skip sub-millisecond regions
                logger.info("      %s  %7.3fs → %7.3fs  (%.3fs)", rtype, rstart, rend, duration)

        return data * gate

    # Determine noise floor
    if noise_profile is not None:
        if noise_profile.ndim == 1:
            noise_floor = compute_noise_floor(noise_profile)
        else:
            noise_floor = float(np.mean([
                compute_noise_floor(noise_profile[ch])
                for ch in range(noise_profile.shape[0])
            ]))
        logger.info("  Noise floor from profile: %.6f (%.1f dBFS)", noise_floor, 20 * np.log10(max(noise_floor, 1e-10)))
    else:
        # Auto-estimate from the quietest frames
        noise_floor = auto_estimate_noise_floor(samples)
        logger.info("  Auto-estimated noise floor: %.6f (%.1f dBFS)", noise_floor, 20 * np.log10(max(noise_floor, 1e-10)))

    if samples.ndim == 1:
        return gate_channel(samples, noise_floor)
    else:
        result = np.empty_like(samples)
        for ch in range(samples.shape[0]):
            result[ch] = gate_channel(samples[ch], noise_floor)
        return result
