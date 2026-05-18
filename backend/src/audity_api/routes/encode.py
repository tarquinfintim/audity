import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from audity_api.services.converter import convert_audio

router = APIRouter()

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024

FORMATS = {
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "wav": "audio/wav",
}


@router.post("/encode")
async def encode(
    file: UploadFile = File(...),
    format: str = Form(...),
    bitrate: str = Form("192k"),
    sample_rate: int | None = Form(None),
):
    if format not in FORMATS:
        raise HTTPException(400, f"Unsupported format: {format}. Use one of: {list(FORMATS.keys())}")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_in:
            tmp_in.write(data)
            tmp_in_path = tmp_in.name

        result_bytes = convert_audio(
            input_path=tmp_in_path,
            output_format=format,
            bitrate=bitrate,
            sample_rate=sample_rate,
        )
    except Exception as e:
        raise HTTPException(500, f"Conversion failed: {e}")
    finally:
        os.unlink(tmp_in_path)

    return Response(
        content=result_bytes,
        media_type=FORMATS[format],
        headers={"Content-Disposition": f'attachment; filename="output.{format}"'},
    )
