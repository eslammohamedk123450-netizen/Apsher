import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";

import { useApp } from "@/lib/local-store";

const C = {
  navy: "#10253F",
  blue: "#2F78C9",
  blueLight: "#EAF3FC",
  bg: "#F6F8FB",
  white: "#FFFFFF",
  muted: "#68768A",
  red: "#CF4B4B",
};

export type AppLockBrand = {
  /** اسم المنظومة الذي يظهر على شاشة القفل */
  appName: string;
  /** أيقونة المنظومة */
  logo: ImageSourcePropType;
  /** اللون الأساسي لمنظومة القفل */
  accent: string;
  /** لون خلفية باهت بنفس الدرجة */
  accentSoft: string;
};

const DEFAULT_BRAND: AppLockBrand = {
  appName: "أبشر",
  logo: require("@/assets/images/icon.png"),
  accent: C.blue,
  accentSoft: C.blueLight,
};

/**
 * قفل المنظومة. يقرأ الرقم السري والبصمة من نفس المصدر المشترك،
 * فيمكن استخدام نفس الرقم في «أبشر» و«مزرعتي» مع اختلاف الهوية البصرية.
 */
export function AppLock({
  children,
  appName = DEFAULT_BRAND.appName,
  logo = DEFAULT_BRAND.logo,
  accent = DEFAULT_BRAND.accent,
  accentSoft = DEFAULT_BRAND.accentSoft,
}: {
  children: React.ReactNode;
} & Partial<AppLockBrand>) {
  const { ready, pin, biometricEnabled, authenticateBiometric } = useApp();
  const [unlockedPin, setUnlockedPin] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !pin || !biometricEnabled) return;
    void authenticateBiometric().then((success) => {
      if (success) setUnlockedPin(pin);
    });
  }, [ready, pin, biometricEnabled, authenticateBiometric]);

  if (!ready)
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={styles.loadingText}>جاري فتح {appName}...</Text>
      </View>
    );
  if (!pin || unlockedPin === pin) return <>{children}</>;

  const unlock = () => {
    if (value === pin) {
      setError("");
      setValue("");
      setUnlockedPin(pin);
    } else {
      setError("الرقم السري غير صحيح");
      setValue("");
    }
  };

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <Text style={styles.title}>{appName}</Text>
      <Text style={styles.subtitle}>
        أدخل الرقم السري الذي تستخدمه في المنظومات
      </Text>
      <View style={[styles.lockIcon, { backgroundColor: accentSoft }]}>
        <Ionicons name="lock-closed-outline" size={30} color={accent} />
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={unlock}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={8}
        placeholder="الرقم السري"
        placeholderTextColor="#9AA7B8"
        style={styles.input}
        textAlign="center"
      />
      <Pressable
        style={[styles.button, { backgroundColor: accent }]}
        onPress={unlock}
      >
        <Text style={styles.buttonText}>فتح المنظومة</Text>
      </Pressable>
      {biometricEnabled ? (
        <Pressable
          style={styles.biometric}
          onPress={() =>
            void authenticateBiometric().then((success) => {
              if (success) setUnlockedPin(pin);
              else Alert.alert("البصمة", "تعذر التحقق بالبصمة.");
            })
          }
        >
          <Ionicons name="finger-print-outline" size={21} color={accent} />
          <Text style={[styles.biometricText, { color: accent }]}>
            فتح بالبصمة
          </Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>
        بياناتك محفوظة على الجهاز ولا تحتاج إلى إنترنت.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.bg,
  },
  loadingText: { color: C.muted, fontSize: 14 },
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  logo: { width: 98, height: 98, borderRadius: 28, marginBottom: 3 },
  title: { color: C.navy, fontSize: 29, fontWeight: "900" },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 9,
  },
  lockIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    maxWidth: 330,
    minHeight: 53,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#C8D7E8",
    backgroundColor: C.white,
    color: C.navy,
    fontSize: 22,
    letterSpacing: 5,
  },
  button: {
    width: "100%",
    maxWidth: 330,
    minHeight: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  buttonText: { color: C.white, fontSize: 14, fontWeight: "900" },
  biometric: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  biometricText: { fontSize: 13, fontWeight: "800" },
  error: { color: C.red, fontSize: 12, fontWeight: "700" },
  note: { color: "#94A0B0", fontSize: 11, textAlign: "center", marginTop: 14 },
});
