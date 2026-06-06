declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: Array<{
        description?: string;
        accept?: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept?: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
}

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
    const picker = window.showOpenFilePicker;
    if (!picker) {
      throw new Error("File System Access API is unavailable");
    }

    const [handle] = await picker({
      types: [
        {
          description: "Audio files",
          accept: { "audio/*": [".wav", ".mp3", ".ogg", ".flac"] },
        },
      ],
    });
    if (!handle) {
      throw new Error("No file handle returned");
    }

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
      const picker = window.showSaveFilePicker;
      if (!picker) {
        return undefined;
      }

      const handle = await picker({
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
