import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/local-store";

const C = { navy: "#10253F", blue: "#2F78C9", blueLight: "#EAF3FC", orange: "#F59E0B", orangeLight: "#FFF6DD", bg: "#F6F8FB", white: "#FFFFFF", muted: "#68768A", border: "#DCE4EF", green: "#16846E", red: "#CF4B4B" };

const confirmImport = (message: string, action: () => void) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(message)) action();
  } else Alert.alert("استرداد نسخة", message, [{ text: "إلغاء", style: "cancel" }, { text: "استرداد", onPress: action }]);
};

export default function SettingsScreen() {
  const { data, autoStatus, pin, biometricEnabled, exportCurrent, exportZip, importZip, setPin, setBiometric } = useApp();
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const run = async (label: string, action: () => Promise<string | null>) => {
    setBusy(label);
    setMessage("");
    try {
      const path = await action();
      setMessage(path ? `تم إنشاء الملف بنجاح. يمكنك مشاركته أو حفظه من نافذة النظام.` : "تم إلغاء العملية.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ العملية");
    } finally {
      setBusy("");
    }
  };

  const savePin = async () => {
    const clean = pinValue.trim();
    if (!/^\d{4,8}$/.test(clean)) {
      Alert.alert("رقم سري غير صحيح", "اكتب رقمًا سريًا من 4 إلى 8 أرقام.");
      return;
    }
    await setPin(clean);
    setPinValue("");
    setPinModal(false);
    setMessage("تم تفعيل حماية الرقم السري.");
  };

  const disablePin = async () => {
    await setPin(null);
    await setBiometric(false);
    setMessage("تم إيقاف حماية التطبيق.");
  };

  const restore = () => confirmImport("سيتم استبدال البيانات الحالية بالنسخة التي تختارها. هل تريد المتابعة؟", async () => {
    setBusy("استرداد");
    try {
      const ok = await importZip();
      setMessage(ok ? "تم استرداد البيانات والصور بنجاح." : "تم إلغاء الاسترداد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ملف ZIP غير صالح");
    } finally {
      setBusy("");
    }
  });

  return <ScreenContainer><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>إدارة التطبيق</Text><Text style={styles.title}>الإعدادات والنسخ</Text><Text style={styles.subtitle}>بياناتك محلية، وتستطيع نقلها في أي وقت إلى جهاز آخر.</Text></View><Image source={require("@/assets/images/icon.png")} style={styles.logo} /></View>

    <View style={styles.statusCard}><View style={styles.statusIcon}><Ionicons name="shield-checkmark-outline" size={23} color={C.green} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.statusTitle}>الحفظ التلقائي نشط</Text><Text style={styles.statusText}>{autoStatus}</Text></View><View style={styles.dot} /></View>

    <Text style={styles.sectionTitle}>النسخ الاحتياطي</Text>
    <View style={styles.card}>
      <SettingRow icon="download-outline" title="تصدير النسخة الحالية" description="ملف JSON واضح يمكن حفظه أو مشاركته الآن" onPress={() => void run("تصدير", exportCurrent)} busy={busy === "تصدير"} />
      <View style={styles.separator} />
      <SettingRow icon="archive-outline" title="تصدير كل البيانات ZIP" description="يشمل الأقسام والمنتجات والصور وسجل المستهلك" onPress={() => void run("ZIP", exportZip)} busy={busy === "ZIP"} accent />
      <View style={styles.separator} />
      <SettingRow icon="cloud-upload-outline" title="استرداد نسخة ZIP" description="استيراد نسخة من هذا الجهاز أو جهاز آخر" onPress={restore} busy={busy === "استرداد"} />
    </View>
    {message ? <View style={styles.message}><Ionicons name="information-circle-outline" size={19} color={C.blue} /><Text style={styles.messageText}>{message}</Text></View> : null}

    <Text style={styles.sectionTitle}>حماية الوصول</Text>
    <View style={styles.card}>
      <View style={styles.securityRow}><View style={styles.securityIcon}><Ionicons name="keypad-outline" size={21} color={C.blue} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.rowTitle}>{pin ? "الرقم السري مفعل" : "تفعيل رقم سري"}</Text><Text style={styles.rowDescription}>{pin ? "سيطلب التطبيق الرقم عند فتحه" : "حماية اختيارية لفتح التطبيق"}</Text></View><Switch value={Boolean(pin)} onValueChange={(value) => value ? setPinModal(true) : void disablePin()} trackColor={{ false: "#CBD5E1", true: "#9DC5ED" }} thumbColor={pin ? C.blue : "#F8FAFC"} /></View>
      {pin ? <><View style={styles.separator} /><View style={styles.securityRow}><View style={styles.securityIcon}><Ionicons name="finger-print-outline" size={21} color={C.blue} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.rowTitle}>فتح بالبصمة</Text><Text style={styles.rowDescription}>يعمل إذا كانت بصمة الجهاز مفعلة</Text></View><Switch value={biometricEnabled} onValueChange={(value) => void setBiometric(value)} trackColor={{ false: "#CBD5E1", true: "#9DC5ED" }} thumbColor={biometricEnabled ? C.blue : "#F8FAFC" } /></View></> : null}
    </View>

    <View style={styles.tip}><Ionicons name="bulb-outline" size={21} color={C.orange} /><Text style={styles.tipText}>للحفاظ على بياناتك بعد حذف التطبيق أو تغيير الهاتف، صدّر ZIP واحفظه في مكان آمن. الاسترداد يعيد الصور والبيانات معًا.</Text></View>
    <Text style={styles.footer}>أبشر · {data.sections.length} أقسام · {data.products.length} منتجات</Text>

    <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}><View style={styles.pinBackdrop}><View style={styles.pinCard}><Text style={styles.pinTitle}>تفعيل الرقم السري</Text><Text style={styles.pinHint}>أدخل من 4 إلى 8 أرقام لحماية فتح التطبيق.</Text><TextInput value={pinValue} onChangeText={setPinValue} keyboardType="number-pad" secureTextEntry maxLength={8} placeholder="••••" placeholderTextColor="#9AA7B8" style={styles.pinInput} textAlign="center" /><View style={styles.pinActions}><Pressable style={styles.cancelButton} onPress={() => { setPinValue(""); setPinModal(false); }}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable style={styles.saveButton} onPress={savePin}><Text style={styles.saveText}>تفعيل</Text></Pressable></View></View></View></Modal>
  </ScrollView></ScreenContainer>;
}

function SettingRow({ icon, title, description, onPress, busy, accent = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; onPress: () => void; busy: boolean; accent?: boolean }) {
  return <Pressable style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.78 }]} onPress={onPress}><View style={[styles.rowIcon, accent && { backgroundColor: C.orangeLight }]}>{busy ? <Text style={styles.busy}>…</Text> : <Ionicons name={icon} size={21} color={accent ? C.orange : C.blue} />}</View><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDescription}>{description}</Text></View><Ionicons name="chevron-back" size={19} color="#8E9BAD" /></Pressable>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 18, paddingBottom: 50, gap: 16, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { color: C.blue, fontSize: 12, fontWeight: "800", marginBottom: 4 },
  title: { color: C.navy, fontSize: 25, fontWeight: "900", textAlign: "right" },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 5 },
  logo: { width: 66, height: 66, borderRadius: 19 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#ECF8F3", borderColor: "#CDEBDD", borderWidth: 1, borderRadius: 17, padding: 13 },
  statusIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.white, alignItems: "center", justifyContent: "center" },
  statusTitle: { color: C.navy, fontSize: 13, fontWeight: "900", textAlign: "right" },
  statusText: { color: C.green, fontSize: 11, textAlign: "right", marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green },
  sectionTitle: { color: C.navy, fontSize: 17, fontWeight: "900", textAlign: "right", marginTop: 2 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 14 },
  settingRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" },
  busy: { color: C.blue, fontSize: 22, fontWeight: "900" },
  rowTitle: { color: C.navy, fontSize: 14, fontWeight: "900", textAlign: "right" },
  rowDescription: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 3 },
  separator: { height: 1, backgroundColor: C.border },
  message: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.blueLight, borderRadius: 13, padding: 11 },
  messageText: { flex: 1, color: C.navy, fontSize: 12, textAlign: "right", lineHeight: 18 },
  securityRow: { minHeight: 75, flexDirection: "row", alignItems: "center", gap: 11 },
  securityIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.orangeLight, borderRadius: 16, padding: 13 },
  tipText: { flex: 1, color: C.navy, fontSize: 12, lineHeight: 19, textAlign: "right" },
  footer: { color: "#98A4B5", fontSize: 11, textAlign: "center", marginTop: 3 },
  pinBackdrop: { flex: 1, backgroundColor: "rgba(16,37,63,0.42)", alignItems: "center", justifyContent: "center", padding: 24 },
  pinCard: { width: "100%", backgroundColor: C.white, borderRadius: 22, padding: 22, gap: 13 },
  pinTitle: { color: C.navy, fontSize: 20, fontWeight: "900", textAlign: "right" },
  pinHint: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  pinInput: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: C.border, color: C.navy, fontSize: 26, letterSpacing: 9, backgroundColor: C.bg },
  pinActions: { flexDirection: "row", gap: 9 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  cancelText: { color: C.muted, fontWeight: "800" },
  saveButton: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  saveText: { color: C.white, fontWeight: "900" },
});
