import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { VoiceRecorder } from "capacitor-voice-recorder";

const AUDIO_DIRECTORY = "RecodingFile";

export type RecordedAudio = {
  blob: Blob;
  fileUri: string;
  playbackUrl: string;
};

function getExtension(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  return "webm";
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function readStoredBlob(path: string, mimeType: string) {
  const { data } = await Filesystem.readFile({
    directory: Directory.Data,
    path,
  });
  return data instanceof Blob ? data : base64ToBlob(data, mimeType);
}

async function ensureAudioRecordingPermission() {
  try {
    const capability = await VoiceRecorder.canDeviceVoiceRecord();
    if (!capability.value) {
      throw new Error("이 기기에서는 음성 녹음을 사용할 수 없습니다.");
    }

    const permission = await VoiceRecorder.hasAudioRecordingPermission();
    if (permission.value) return;

    const requested = await VoiceRecorder.requestAudioRecordingPermission();
    if (!requested.value) {
      throw new Error("마이크 권한이 거부되었습니다. 설정에서 마이크 권한을 허용해주세요.");
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("마이크 권한을 확인하지 못했습니다.");
  }
}

export function useAudioRecorder() {
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);
  const isMountedRef = useRef(true);

  const clearRecording = useCallback(() => {
    setRecordedAudio(null);
  }, []);

  const selectAudioFile = useCallback((file: File) => {
    if (!file.type.startsWith("audio/")) {
      throw new Error("음성 파일만 선택할 수 있습니다.");
    }

    const nextAudio = {
      blob: file,
      fileUri: file.name,
      playbackUrl: URL.createObjectURL(file),
    };
    setRecordedAudio(nextAudio);
    return nextAudio;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      await ensureAudioRecordingPermission();

      if (Capacitor.isNativePlatform()) {
        await Filesystem.requestPermissions().catch((error) => {
          console.warn("Filesystem permission request failed; continuing with app-private storage.", error);
        });
      }

      setRecordedAudio(null);
      await VoiceRecorder.startRecording({
        directory: Directory.Data,
        subDirectory: AUDIO_DIRECTORY,
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "녹음을 시작하지 못했습니다.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    let value;
    try {
      ({ value } = await VoiceRecorder.stopRecording());
    } catch {
      throw new Error("녹음을 종료하지 못했습니다. 다시 시도해주세요.");
    }
    const mimeType = value.mimeType || "audio/webm";
    let path = value.path;

    if (!path) {
      if (!value.recordDataBase64) {
        throw new Error("녹음 파일을 가져오지 못했습니다.");
      }
      path = `${AUDIO_DIRECTORY}/recording-${Date.now()}.${getExtension(mimeType)}`;
      await Filesystem.writeFile({
        directory: Directory.Data,
        path,
        data: value.recordDataBase64,
        recursive: true,
      });
    }

    const [{ uri }, blob] = await Promise.all([
      Filesystem.getUri({ directory: Directory.Data, path }),
      readStoredBlob(path, mimeType),
    ]);
    const playbackUrl = Capacitor.isNativePlatform()
      ? Capacitor.convertFileSrc(uri)
      : URL.createObjectURL(blob);
    const nextAudio = { blob, fileUri: uri, playbackUrl };

    if (isMountedRef.current) setRecordedAudio(nextAudio);
    return nextAudio;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      VoiceRecorder.getCurrentStatus()
        .then(({ status }) => {
          if (status === "RECORDING" || status === "PAUSED") {
            return VoiceRecorder.stopRecording();
          }
        })
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (
        recordedAudio?.playbackUrl &&
        !Capacitor.isNativePlatform()
      ) {
        URL.revokeObjectURL(recordedAudio.playbackUrl);
      }
    };
  }, [recordedAudio]);

  return {
    clearRecording,
    recordedAudio,
    selectAudioFile,
    startRecording,
    stopRecording,
  };
}
