import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const C = {
  navy: "#10253F",
  white: "#FFFFFF",
  muted: "#68768A",
  border: "#DCE4EF",
};

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  accent?: string;
  onBack?: () => void;
  /** زر «المنظومات» للرجوع إلى شاشة اختيار المنظومات */
  onLauncher?: () => void;
  right?: React.ReactNode;
};

/** شريط علوي موحّد لشاشات «مزرعتي»: رجوع + عنوان + زر المنظومات. */
export function AppHeader({
  title,
  subtitle,
  accent = "#178A5A",
  onBack,
  onLauncher,
  right,
}: AppHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={C.navy} />
        </Pressable>
      ) : null}

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onLauncher ? (
        <Pressable onPress={onLauncher} style={styles.launcherBtn} hitSlop={6}>
          <Ionicons name="grid-outline" size={16} color={accent} />
          <Text style={[styles.launcherText, { color: accent }]}>
            المنظومات
          </Text>
        </Pressable>
      ) : null}

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 1 },
  title: { color: C.navy, fontSize: 18, fontWeight: "900", textAlign: "right" },
  subtitle: { color: C.muted, fontSize: 11, textAlign: "right" },
  launcherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: "#F1F5FA",
  },
  launcherText: { fontSize: 12, fontWeight: "800" },
});
