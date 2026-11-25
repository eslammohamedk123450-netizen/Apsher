import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

export type RecordedVoice = { uri: string; durationMs: number };

/**
 * تسجيل صوتي بسيط: بدء/إيقاف، مع إمكانية الإلغاء.
 * يحفظ الصوت كملف دائم عبر `saveAudio` في طبقة البيانات.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    try {
      setBusy(true);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "الميكروفون",
          "اسمح بالوصول للميكروفون لتسجيل الملاحظات الصوتية.",
        );
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch {
      Alert.alert("تسجيل الصوت", "تعذر بدء التسجيل على هذا الجهاز.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [recorder]);

  const stop = useCallback(async (): Promise<RecordedVoice | null> => {
    try {
      setBusy(true);
      const durationMs = state.durationMillis;
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });
      if (!uri) return null;
      return { uri, durationMs };
    } catch {
      Alert.alert("تسجيل الصوت", "تعذر حفظ التسجيل.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [recorder, state.durationMillis]);

  const cancel = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // تجاهل: ربما لم يبدأ التسجيل فعلًا
    }
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // تجاهل
    }
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    busy,
    start,
    stop,
    cancel,
  };
}
