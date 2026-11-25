import { useRouter } from "expo-router";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";

const C = {
  navy: "#10253F",
  blue: "#2F78C9",
  green: "#178A5A",
  bg: "#F6F8FB",
  white: "#FFFFFF",
  muted: "#68768A",
  border: "#DCE4EF",
};

const APP_NAME = "Super Notes";
const TAGLINE = "نظّم • رتّب • انجح";
const DEVELOPER = "من تطوير شركة Suly Technologies";
const VERSION = "الإصدار 1.0.46";

/** بطاقة منظومة كبيرة تملأ جزءًا من الشاشة بأيقونة بارزة واسم واضح. */
function SystemCard({
  title,
  icon,
  color,
  onPress,
}: {
  title: string;
  icon: ImageSourcePropType;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color },
        pressed && styles.cardPressed,
      ]}
      accessibilityLabel={title}
    >
      <View style={styles.cardTile}>
        <Image source={icon} style={styles.cardIcon} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </Pressable>
  );
}

export default function LauncherScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} style={styles.root}>
      {/* رأس بسيط: اللوجو + الاسم في الأعلى */}
      <View style={styles.header}>
        <Image source={require("@/assets/images/super-notes-icon.png")} style={styles.logo} />
        <View style={styles.headerCopy}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>
      </View>

      {/* المنظومات: بطاقتان تكادان تملآن الشاشة */}
      <View style={styles.board}>
        <SystemCard
          title="أبشر"
          icon={require("@/assets/images/icon.png")}
          color={C.blue}
          onPress={() => router.push("/apsher")}
        />
        <SystemCard
          title="مزرعتي"
          icon={require("@/assets/images/mazraaty-icon.png")}
          color={C.green}
          onPress={() => router.push("/mazraaty")}
        />
      </View>

      {/* تذييل بسيط */}
      <View style={styles.footer}>
        <Text style={styles.developer}>{DEVELOPER}</Text>
        <Text style={styles.version}>{VERSION}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logo: { width: 44, height: 44, borderRadius: 14 },
  headerCopy: { flex: 1, gap: 2 },
  appName: { color: C.navy, fontSize: 20, fontWeight: "900", textAlign: "right" },
  tagline: {
    color: C.blue,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "right",
  },

  board: { flex: 1, padding: 16, gap: 14 },
  card: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    shadowColor: "#10253F",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  cardTile: {
    width: 128,
    height: 128,
    borderRadius: 34,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10253F",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  cardIcon: { width: 106, height: 106, borderRadius: 28 },
  cardTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  footer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.bg,
    alignItems: "center",
  },
  developer: {
    color: C.navy,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 2,
  },
  version: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
  },
});
