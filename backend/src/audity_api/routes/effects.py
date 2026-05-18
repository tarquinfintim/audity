"""
API routes for DSP effects processed on the backend.
All endpoints accept WAV audio + parameters and return processed WAV.
"""

import io
import logging
import os
import struct
import time

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

logger = logging.getLogger(__name__)

from audity_api.services.dsp import (
    apply_adaptive_gate,
    apply_compressor,
    apply_filter,
    apply_noise_reduction,
)

router = APIRouter()

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024


def decode_wav(data: bytes) -> tuple[np.ndarray, int, int]:
    """Decode a PCM WAV file to numpy float32 array. Returns (samples, sample_rate, channels)."""
    if len(data) < 44:
        raise ValueError("WAV file too small")

    # Parse RIFF header
    riff, size, wave = struct.unpack_from("<4sI4s", data, 0)
    if riff != b"RIFF" or wave != b"WAVE":
        raise ValueError("Not a valid WAV file")

    # Find fmt chunk
    offset = 12
    fmt_found = False
    sample_rate = 44100
    channels = 1
    bits_per_sample = 16

    while offset < len(data) - 8:
        chunk_id, chunk_size = struct.unpack_from("<4sI", data, offset)
        offset += 8

        if chunk_id == b"fmt ":
            audio_format, channels, sample_rate, _, _, bits_per_sample = struct.unpack_from(
                "<HHIIHH", data, offset
            )
            if audio_format not in (1, 3):  # PCM or IEEE float
                raise ValueError(f"Unsupported WAV format: {audio_format}")
            fmt_found = True
            offset += chunk_size
        elif chunk_id == b"data":
            pcm_data = data[offset : offset + chunk_size]
            break
        else:
            offset += chunk_size
    else:
        raise ValueError("No data chunk found")

    if not fmt_found:
        raise ValueError("No fmt chunk found")

    # Convert to float32
    if bits_per_sample == 16:
        samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32) / 32768.0
    elif bits_per_sample == 24:
        # 24-bit PCM
        n_samples = len(pcm_data) // 3
        raw = np.zeros(n_samples, dtype=np.int32)
        for i in range(n_samples):
            b = pcm_data[i * 3 : i * 3 + 3]
            val = b[0] | (b[1] << 8) | (b[2] << 16)
            if val & 0x800000:
                val -= 0x1000000
            raw[i] = val
        samples = raw.astype(np.float32) / 8388608.0
    elif bits_per_sample == 32:
        if audio_format == 3:  # IEEE float
            samples = np.frombuffer(pcm_data, dtype=np.float32).copy()
        else:
            samples = np.frombuffer(pcm_data, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported bit depth: {bits_per_sample}")

    # Reshape to (channels, samples_per_channel)
    if channels > 1:
        samples = samples.reshape(-1, channels).T

    return samples, sample_rate, channels


def encode_wav(samples: np.ndarray, sample_rate: int, channels: int) -> bytes:
    """Encode numpy float32 array to 16-bit PCM WAV."""
    if samples.ndim == 2:
        # Interleave channels: (channels, samples) -> (samples, channels) -> flat
        interleaved = samples.T.flatten()
    else:
        interleaved = samples

    # Clip and convert to int16
    clipped = np.clip(interleaved, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)
    pcm_bytes = pcm.tobytes()

    # Build WAV
    num_samples = len(pcm_bytes)
    bits_per_sample = 16
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    buf = io.BytesIO()
    # RIFF header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + num_samples))
    buf.write(b"WAVE")
    # fmt chunk
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<HHIIHH", 1, channels, sample_rate, byte_rate, block_align, bits_per_sample))
    # data chunk
    buf.write(b"data")
    buf.write(struct.pack("<I", num_samples))
    buf.write(pcm_bytes)

    return buf.getvalue()


@router.post("/effects/filter")
async def effect_filter(
    file: UploadFile = File(...),
    filter_type: str = Form(...),
    frequency: float = Form(...),
    q: float = Form(0.707),
    start_sample: int = Form(0),
    end_sample: int = Form(-1),
):
    """Apply a filter (lowpass, highpass, bandpass, notch)."""
    logger.info("Filter: type=%s freq=%.1fHz Q=%.3f range=[%d:%d]", filter_type, frequency, q, start_sample, end_sample)
    t0 = time.perf_counter()
    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    try:
        samples, sr, channels = decode_wav(data)
        logger.info("  Decoded: %d ch, %d Hz, %d samples", channels, sr, samples.shape[-1])

        # Extract region
        total_samples = samples.shape[-1]
        start = max(0, start_sample)
        end = end_sample if end_sample > 0 else total_samples

        if samples.ndim == 1:
            region = samples[start:end]
            processed = apply_filter(region, sr, filter_type, frequency, q)
            samples[start:end] = processed
        else:
            region = samples[:, start:end]
            processed = apply_filter(region, sr, filter_type, frequency, q)
            samples[:, start:end] = processed

        result = encode_wav(samples, sr, channels)
    except ValueError as e:
        logger.error("  Filter error: %s", e)
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("  Filter failed")
        raise HTTPException(500, f"Effect failed: {e}")

    logger.info("  Filter done in %.3fs", time.perf_counter() - t0)
    return Response(content=result, media_type="audio/wav")


@router.post("/effects/noise-reduce")
async def effect_noise_reduce(
    file: UploadFile = File(...),
    noise_file: UploadFile | None = File(None),
    strength: float = Form(0.6),
    start_sample: int = Form(0),
    end_sample: int = Form(-1),
):
    """Apply spectral noise reduction using noisereduce library."""
    logger.info("Noise Reduce: strength=%.2f range=[%d:%d] has_noise_file=%s", strength, start_sample, end_sample, noise_file is not None)
    t0 = time.perf_counter()
    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    noise_profile = None
    if noise_file:
        noise_data = await noise_file.read()
        try:
            noise_profile, _, _ = decode_wav(noise_data)
            logger.info("  Noise profile: %d samples", noise_profile.shape[-1])
        except Exception as e:
            logger.warning("  Failed to decode noise file: %s", e)
            noise_profile = None

    try:
        samples, sr, channels = decode_wav(data)
        logger.info("  Decoded: %d ch, %d Hz, %d samples", channels, sr, samples.shape[-1])

        total_samples = samples.shape[-1]
        start = max(0, start_sample)
        end = end_sample if end_sample > 0 else total_samples

        if samples.ndim == 1:
            region = samples[start:end]
            processed = apply_noise_reduction(region, sr, noise_profile, strength)
            samples[start:end] = processed
        else:
            region = samples[:, start:end]
            noise_p = noise_profile if noise_profile is not None else None
            processed = apply_noise_reduction(region, sr, noise_p, strength)
            samples[:, start:end] = processed

        result = encode_wav(samples, sr, channels)
    except ValueError as e:
        logger.error("  Noise reduce error: %s", e)
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("  Noise reduce failed")
        raise HTTPException(500, f"Effect failed: {e}")

    logger.info("  Noise reduce done in %.3fs", time.perf_counter() - t0)
    return Response(content=result, media_type="audio/wav")


@router.post("/effects/compressor")
async def effect_compressor(
    file: UploadFile = File(...),
    threshold_db: float = Form(-20),
    ratio: float = Form(4),
    attack: float = Form(0.01),
    release: float = Form(0.25),
    knee_db: float = Form(10),
    makeup_gain_db: float = Form(0),
    start_sample: int = Form(0),
    end_sample: int = Form(-1),
):
    """Apply dynamic range compression."""
    logger.info("Compressor: threshold=%.1fdB ratio=%.1f attack=%.3f release=%.3f knee=%.1fdB makeup=%.1fdB range=[%d:%d]",
               threshold_db, ratio, attack, release, knee_db, makeup_gain_db, start_sample, end_sample)
    t0 = time.perf_counter()
    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    try:
        samples, sr, channels = decode_wav(data)
        logger.info("  Decoded: %d ch, %d Hz, %d samples", channels, sr, samples.shape[-1])

        total_samples = samples.shape[-1]
        start = max(0, start_sample)
        end = end_sample if end_sample > 0 else total_samples

        if samples.ndim == 1:
            region = samples[start:end]
            processed = apply_compressor(
                region, sr, threshold_db, ratio, attack, release, knee_db, makeup_gain_db
            )
            samples[start:end] = processed
        else:
            region = samples[:, start:end]
            processed = apply_compressor(
                region, sr, threshold_db, ratio, attack, release, knee_db, makeup_gain_db
            )
            samples[:, start:end] = processed

        result = encode_wav(samples, sr, channels)
    except ValueError as e:
        logger.error("  Compressor error: %s", e)
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("  Compressor failed")
        raise HTTPException(500, f"Effect failed: {e}")

    logger.info("  Compressor done in %.3fs", time.perf_counter() - t0)
    return Response(content=result, media_type="audio/wav")


@router.post("/effects/adaptive-gate")
async def effect_adaptive_gate(
    file: UploadFile = File(...),
    noise_file: UploadFile | None = File(None),
    threshold_margin_db: float = Form(6.0),
    lookahead_ms: float = Form(30.0),
    attack_ms: float = Form(5.0),
    hold_ms: float = Form(100.0),
    release_ms: float = Form(50.0),
    start_sample: int = Form(0),
    end_sample: int = Form(-1),
):
    """
    Adaptive Background Muting — a noise gate with look-ahead.
    Good for nature recordings with no natural background noise (only recorder self-noise).

    Silences audio that stays within the noise floor amplitude range,
    with a look-ahead window to open the gate BEFORE transients arrive.
    """
    logger.info("Adaptive Gate: margin=%.1fdB lookahead=%.1fms attack=%.1fms hold=%.1fms release=%.1fms range=[%d:%d] has_noise_file=%s",
               threshold_margin_db, lookahead_ms, attack_ms, hold_ms, release_ms, start_sample, end_sample, noise_file is not None)
    t0 = time.perf_counter()
    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    noise_profile = None
    if noise_file:
        noise_data = await noise_file.read()
        try:
            noise_profile, _, _ = decode_wav(noise_data)
            logger.info("  Noise profile: %d samples", noise_profile.shape[-1])
        except Exception as e:
            logger.warning("  Failed to decode noise file: %s", e)
            noise_profile = None

    try:
        samples, sr, channels = decode_wav(data)
        logger.info("  Decoded: %d ch, %d Hz, %d samples", channels, sr, samples.shape[-1])

        total_samples = samples.shape[-1]
        start = max(0, start_sample)
        end = end_sample if end_sample > 0 else total_samples

        if samples.ndim == 1:
            region = samples[start:end]
            processed = apply_adaptive_gate(
                region, sr, noise_profile,
                threshold_margin_db, lookahead_ms, attack_ms, hold_ms, release_ms,
            )
            samples[start:end] = processed
        else:
            region = samples[:, start:end]
            processed = apply_adaptive_gate(
                region, sr, noise_profile,
                threshold_margin_db, lookahead_ms, attack_ms, hold_ms, release_ms,
            )
            samples[:, start:end] = processed

        result = encode_wav(samples, sr, channels)
    except ValueError as e:
        logger.error("  Adaptive gate error: %s", e)
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("  Adaptive gate failed")
        raise HTTPException(500, f"Effect failed: {e}")

    logger.info("  Adaptive gate done in %.3fs", time.perf_counter() - t0)
    return Response(content=result, media_type="audio/wav")
