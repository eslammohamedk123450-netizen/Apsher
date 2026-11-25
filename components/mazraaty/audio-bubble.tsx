import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDuration } from "@/lib/mazraaty-store";

/**
 * فقاعة ملاحظة صوتية: زر تشغيل/إيقاف + موجة + المدة، على طريقة واتساب.
 *
 * ملاحظات مهمة لضمان التشغيل:
 * - نضبط وضع الصوت لل playback قبل التشغيل حتى لا يخرج صامتًا.
 * - على الويب نحوّل روابط data: إلى Blob URL لأن تشغيلها المباشر غير موثوق.
 * - نستبدل مصدر المشغل عند تغيّره بدل إنشاء مشغل جديد.
 */
export function AudioBubble({
  uri,
  durationMs,
  accent = "#178A5A",
}: {
  uri: string;
  durationMs?: number;
  accent?: string;
}) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef<string | null>(null);

  // تجهيز المصدر (وتحويل data: إلى Blob على الويب).
  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!uri) {
      setSource(null);
      return;
    }

    if (Platform.OS === "web" && uri.startsWith("data:")) {
      void (async () => {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          blobRef.current = url;
          setSource(url);
        } catch {
          if (!cancelled) setSource(uri);
        }
      })();
    } else {
      setSource(uri);
    }

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [uri]);

  // ربط المصدر بالمشغل.
  useEffect(() => {
    if (!source) return;
    try {
      player.replace(source);
    } catch {
      setFailed(true);
    }
  }, [player, source]);

  const playing = status.playing;
  const totalMs = status.duration ? status.duration * 1000 : durationMs ?? 0;
  const currentMs = status.currentTime ? status.currentTime * 1000 : 0;
  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  const toggle = async () => {
    if (playing) {
      try {
        player.pause();
      } catch {
        setFailed(true);
      }
      return;
    }
    // وضع التشغيل: بدون تسجيل، ويعمل حتى مع الوضع الصامت.
    // فشل ضبط الوضع لا يمنع التشغيل، لذا نتجاهله ونكمل.
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {
      /* تجاهل */
    }
    try {
      if (status.didJustFinish || (totalMs > 0 && currentMs >= totalMs - 150)) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setFailed(true);
      if (Platform.OS !== "web") {
        Alert.alert("تعذر التشغيل", "لم نتمكن من تشغيل هذا التسجيل على هذا الجهاز.");
      }
    }
  };

  const bars = [0.4, 0.7, 1, 0.55, 0.85, 0.45, 0.75, 0.5, 0.9, 0.6];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        style={[styles.playBtn, { backgroundColor: accent }]}
        hitSlop={6}
        accessibilityLabel={playing ? "إيقاف مؤقت" : "تشغيل التسجيل"}
      >
        <Ionicons name={playing ? "pause" : "play"} size={18} color="#FFFFFF" />
      </Pressable>

      <View style={styles.bars}>
        {bars.map((h, index) => {
          const filled = index / bars.length <= progress;
          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: 6 + h * 16,
                  backgroundColor: filled ? accent : "#C4D3E2",
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.time}>
        {failed
          ? "تعذر"
          : playing || progress > 0
            ? formatDuration(currentMs)
            : formatDuration(totalMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 190 },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  bars: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 26 },
  bar: { width: 3.5, borderRadius: 999 },
  time: {
    color: "#68768A",
    fontSize: 11,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "left",
  },
});