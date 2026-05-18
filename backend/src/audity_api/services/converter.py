import tempfile

from pydub import AudioSegment


def convert_audio(
    input_path: str,
    output_format: str,
    bitrate: str = "192k",
    sample_rate: int | None = None,
) -> bytes:
    audio = AudioSegment.from_file(input_path)

    if sample_rate:
        audio = audio.set_frame_rate(sample_rate)

    with tempfile.NamedTemporaryFile(suffix=f".{output_format}", delete=False) as tmp_out:
        export_params: dict = {}
        if output_format in ("mp3", "ogg"):
            export_params["bitrate"] = bitrate

        audio.export(tmp_out.name, format=output_format, **export_params)

        with open(tmp_out.name, "rb") as f:
            return f.read()
