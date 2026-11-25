import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatDuration } from "@/lib/mazraaty-store";

/**
 * فقاعة ملاحظة صوتية: زر تشغيل/إيقاف + موجة + المدة، على طريقة واتساب.
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
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const totalMs = status.duration ? status.duration * 1000 : durationMs ?? 0;
  const currentMs = status.currentTime ? status.currentTime * 1000 : 0;
  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  const toggle = () => {
    if (playing) {
      player.pause();
      return;
    }
    if (totalMs > 0 && currentMs >= totalMs - 120) {
      void player.seekTo(0);
    }
    player.play();
  };

  const bars = [0.4, 0.7, 1, 0.55, 0.85, 0.45, 0.75, 0.5, 0.9, 0.6];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        style={[styles.playBtn, { backgroundColor: accent }]}
        hitSlop={6}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={18}
          color="#FFFFFF"
        />
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
        {playing || progress > 0
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
