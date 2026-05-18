/**
 * File System Access API wrapper with <input type="file"> fallback.
 */

export function supportsFileSystemAccess(): boolean {
  return "showOpenFilePicker" in window;
}

export interface FileHandle {
  name: string;
  handle?: FileSystemFileHandle;
}

export async function openAudioFile(): Promise<{
  file: File;
  handle?: FileSystemFileHandle;
}> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Audio files",
          accept: { "audio/*": [".wav", ".mp3", ".ogg", ".flac"] },
        },
      ],
    });
    const file = await handle.getFile();
    return { file, handle };
  }

  // Fallback: <input type="file">
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.wav,.mp3,.ogg,.flac";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) resolve({ file });
      else reject(new Error("No file selected"));
    };
    input.oncancel = () => reject(new Error("File picker cancelled"));
    input.click();
  });
}

const FILE_TYPE_MAP: Record<string, { description: string; mime: string; ext: string }> = {
  wav: { description: "WAV audio", mime: "audio/wav", ext: ".wav" },
  mp3: { description: "MP3 audio", mime: "audio/mpeg", ext: ".mp3" },
  ogg: { description: "OGG audio", mime: "audio/ogg", ext: ".ogg" },
  flac: { description: "FLAC audio", mime: "audio/flac", ext: ".flac" },
};

export async function saveFile(
  blob: Blob,
  suggestedName: string,
  existingHandle?: FileSystemFileHandle,
): Promise<FileSystemFileHandle | undefined> {
  if (supportsFileSystemAccess() && existingHandle) {
    const writable = await existingHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return existingHandle;
  }

  // Determine file type from extension
  const ext = suggestedName.split(".").pop()?.toLowerCase() ?? "wav";
  const typeInfo = FILE_TYPE_MAP[ext] ?? FILE_TYPE_MAP.wav!;

  if (supportsFileSystemAccess()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: typeInfo.description,
            accept: { [typeInfo.mime]: [typeInfo.ext] } as Record<string, string[]>,
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle;
    } catch {
      // User cancelled the dialog
      return undefined;
    }
  }

  // Fallback: download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return undefined;
}
