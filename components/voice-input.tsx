import { Ionicons } from "@expo/vector-icons";
import { Alert, Platform, Pressable, StyleSheet, Text } from "react-native";

export function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const start = () => {
    if (Platform.OS !== "web") {
      Alert.alert("الإملاء الصوتي", "استخدم زر الميكروفون في لوحة مفاتيح Android أو iOS داخل هذا الحقل.");
      return;
    }
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null } }).SpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("الإملاء الصوتي", "المتصفح الحالي لا يدعم الإملاء الصوتي.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.onresult = (event) => onText(event.results[0][0].transcript);
    recognition.onerror = () => Alert.alert("الإملاء الصوتي", "تعذر التقاط الصوت. تحقق من إذن الميكروفون.");
    recognition.start();
  };
  return <Pressable accessibilityLabel="إملاء صوتي" onPress={start} style={styles.button}><Ionicons name="mic-outline" size={16} color="#2F78C9" /><Text style={styles.text}>إملاء صوتي</Text></Pressable>;
}

const styles = StyleSheet.create({ button: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 }, text: { color: "#2F78C9", fontSize: 11, fontWeight: "800" } });
