import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/mazraaty/app-header";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import { downloadResultMessage, type DownloadResult } from "@/lib/download";
import { useApp } from "@/lib/local-store";
import {
  formatDateTime,
  useMazraaty,
} from "@/lib/mazraaty-store";
import {
  exportMazraatyZip,
  exportSuperNotesBackup,
  importMazraatyBackup,
  importSuperNotesBackup,
  saveApsherPayload,
} from "@/lib/super-backup";

export default function MazraatySettingsScreen() {
  const router = useRouter();
  const { data, mergeAll } = useMazraaty();
  const {
    pin,
    biometricEnabled,
    setPin,
    setBiometric,
  } = useApp();

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");

  const reloadApp = () => {
    if (Platform.OS === "web" && typeof window !== "undefined")
      window.location.reload();
  };

  const run = async (
    label: string,
    action: () => Promise<DownloadResult>,
  ) => {
    setBusy(label);
    setMessage("");
    try {
      const result = await action();
      setMessage(downloadResultMessage(result) ?? "تمت العملية.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تعذر تنفيذ العملية",
      );
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
    setMessage("تم تفعيل حماية الرقم السري (مشتركة مع أبشر).");
  };

  const disablePin = async () => {
    await setPin(null);
    await setBiometric(false);
    setMessage("تم إيقاف حماية المنظومات.");
  };

  const restoreCombined = () =>
    confirmAction(
      "سيتم دمج بيانات مزرعتي (وأبشر إن كانت داخل النسخة) مع بياناتك الحالية. هل تريد المتابعة؟",
      async () => {
        setBusy("استرداد");
        setMessage("");
        try {
          const result = await importSuperNotesBackup();
          if (!result) {
            setMessage("تم إلغاء الاسترداد.");
            return;
          }
          if (result.mazraaty) mergeAll(result.mazraaty);
          if (result.apsher) await saveApsherPayload(result.apsher);
          const systems = [
            result.apsher ? "أبشر" : null,
            result.mazraaty ? "مزرعتي" : null,
          ]
            .filter(Boolean)
            .join(" + ");
          setMessage(`تم استرداد ودمج: ${systems}. أعد فتح التطبيق إن لم تظهر البيانات.`);
          if (result.apsher) setTimeout(reloadApp, 800);
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "ملف غير صالح",
          );
        } finally {
          setBusy("");
        }
      },
      "استرداد",
    );

  const restoreMazraaty = () =>
    confirmAction(
      "سيتم دمج بيانات مزرعتي من النسخة المختارة مع الموجودة. متأكد؟",
      async () => {
        setBusy("استرداد مزرعتي");
        setMessage("");
        try {
          const imported = await importMazraatyBackup();
          if (!imported) {
            setMessage("تم إلغاء الاسترداد.");
            return;
          }
          mergeAll(imported);
          setMessage("تم استرداد ودمج بيانات مزرعتي بنجاح.");
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "ملف غير صالح",
          );
        } finally {
          setBusy("");
        }
      },
      "استرداد",
    );

  const sections = data.sections;
  const items = data.items;
  const notes = data.notes;
  const active = <T extends { archivedAt?: string | null }>(list: T[]) =>
    list.filter((entry) => !entry.archivedAt).length;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <AppHeader
          title="الإعدادات"
          subtitle="النسخ الاحتياطي والحماية والإحصائيات"
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {/* الحالة */}
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={MZ.green}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>الحفظ التلقائي على الجهاز</Text>
              <Text style={styles.statusText}>
                آخر حفظ {formatDateTime(data.updatedAt)}
              </Text>
            </View>
            <View style={styles.dot} />
          </View>

          <Text style={styles.sectionTitle}>الإحصائيات</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="folder-open-outline"
              value={sections.length}
              label="أقسام"
              sub={`${active(sections)} نشط`}
            />
            <StatCard
              icon="cube-outline"
              value={items.length}
              label="عناصر"
              sub={`${active(items)} نشط`}
            />
            <StatCard
              icon="chatbubbles-outline"
              value={notes.filter((n) => n.kind === "text").length}
              label="ملاحظات نصية"
              sub="نصية"
            />
            <StatCard
              icon="image-outline"
              value={notes.filter((n) => n.kind === "image").length}
              label="ملاحظات صور"
              sub="صور"
            />
            <StatCard
              icon="mic-outline"
              value={notes.filter((n) => n.kind === "voice").length}
              label="تسجيلات صوتية"
              sub="صوت"
            />
            <StatCard
              icon="trash-outline"
              value={data.trash.length}
              label="في المحذوف"
              sub="محذوف"
            />
          </View>

          <Text style={styles.sectionTitle}>المنظومات</Text>
          <View style={styles.card}>
            <SettingRow
              icon="grid-outline"
              title="الرجوع إلى المنظومات"
              description="عد إلى شاشة اختيار المنظومات أو افتح منظومة أخرى"
              onPress={() => router.replace("/")}
            />
          </View>

          <Text style={styles.sectionTitle}>النسخ الاحتياطي</Text>
          <View style={styles.card}>
            <SettingRow
              icon="layers-outline"
              title="تصدير نسخة كاملة (كل المنظومات)"
              description="ملف واحد فيه فولدر أبشر وفولدر مزرعتي مع الصور والصوت"
              onPress={() => void run("كاملة", () => exportSuperNotesBackup())}
              busy={busy === "كاملة"}
              accent
            />
            <View style={styles.separator} />
            <SettingRow
              icon="cloud-upload-outline"
              title="استرداد النسخة الكاملة"
              description="يستعيد كل المنظومات من ملف واحد بعد تأكيد"
              onPress={restoreCombined}
              busy={busy === "استرداد"}
              accent
            />
            <View style={styles.separator} />
            <SettingRow
              icon="archive-outline"
              title="تصدير نسخة مزرعتي"
              description="ملف ZIP يضم الأقسام والعناصر والملاحظات والوسائط"
              onPress={() => void run("مزرعتي", () => exportMazraatyZip(data))}
              busy={busy === "مزرعتي"}
            />
            <View style={styles.separator} />
            <SettingRow
              icon="document-outline"
              title="استرداد نسخة مزرعتي"
              description="استيراد ملف ZIP أو JSON من هذا الجهاز أو جهاز آخر"
              onPress={restoreMazraaty}
              busy={busy === "استرداد مزرعتي"}
            />
          </View>
          {message ? (
            <View style={styles.message}>
              <Ionicons
                name="information-circle-outline"
                size={19}
                color={MZ.green}
              />
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>حماية الوصول</Text>
          <View style={styles.card}>
            <View style={styles.securityRow}>
              <View style={styles.securityIcon}>
                <Ionicons name="keypad-outline" size={21} color={MZ.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {pin ? "الرقم السري مفعل" : "تفعيل رقم سري"}
                </Text>
                <Text style={styles.rowDescription}>
                  {pin
                    ? "نفس الرقم المستخدم في أبشر"
                    : "حماية موحّدة لكل المنظومات"}
                </Text>
              </View>
              <Switch
                value={Boolean(pin)}
                onValueChange={(value) =>
                  value ? setPinModal(true) : void disablePin()
                }
                trackColor={{ false: "#CBD5E1", true: "#9FD8BE" }}
                thumbColor={pin ? MZ.green : "#F8FAFC"}
              />
            </View>
            {pin ? (
              <>
                <View style={styles.separator} />
                <View style={styles.securityRow}>
                  <View style={styles.securityIcon}>
                    <Ionicons
                      name="finger-print-outline"
                      size={21}
                      color={MZ.green}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>فتح بالبصمة</Text>
                    <Text style={styles.rowDescription}>
                      يعمل إذا كانت بصمة الجهاز مفعلة
                    </Text>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={(value) => void setBiometric(value)}
                    trackColor={{ false: "#CBD5E1", true: "#9FD8BE" }}
                    thumbColor={biometricEnabled ? MZ.green : "#F8FAFC"}
                  />
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.tip}>
            <Ionicons name="leaf-outline" size={20} color={MZ.green} />
            <Text style={styles.tipText}>
              مزرعتي يشارك أبشر في نفس الرقم السري، لكن بيانات كل منظومة تبقى
              مستقلة تمامًا وتُحفظ داخل نفس الجهاز دون حاجة إلى إنترنت.
            </Text>
          </View>

          <Text style={styles.footer}>
            مزرعتي · {sections.length} أقسام · {items.length} عناصر ·{" "}
            {notes.length} ملاحظة
          </Text>
        </ScrollView>

        <Modal
          visible={pinModal}
          transparent
          animationType="fade"
          onRequestClose={() => setPinModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.pinBackdrop}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.pinCard}>
              <Text style={styles.pinTitle}>تفعيل الرقم السري</Text>
              <Text style={styles.pinHint}>
                أدخل من 4 إلى 8 أرقام. سيُطلب نفس الرقم لفتح أبشر ومزرعتي.
              </Text>
              <TextInput
                value={pinValue}
                onChangeText={setPinValue}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                placeholder="••••"
                placeholderTextColor="#9AA7B8"
                style={styles.pinInput}
                textAlign="center"
              />
              <View style={styles.pinActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setPinValue("");
                    setPinModal(false);
                  }}
                >
                  <Text style={styles.cancelText}>إلغاء</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={savePin}>
                  <Text style={styles.saveText}>تفعيل</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

function StatCard({
  icon,
  value,
  label,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={MZ.green} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  description,
  onPress,
  busy = false,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  busy?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.78 }]}
      onPress={onPress}
    >
      <View
        style={[styles.rowIcon, accent && { backgroundColor: "#FFF6DD" }]}
      >
        {busy ? (
          <Text style={styles.busy}>...</Text>
        ) : (
          <Ionicons
            name={icon}
            size={20}
            color={accent ? "#F59E0B" : MZ.green}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color="#8E9BAD" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#ECF8F3",
    borderColor: "#CDEBDD",
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: MZ.white,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    color: MZ.navy,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  statusText: {
    color: MZ.green,
    fontSize: 11,
    textAlign: "right",
    marginTop: 3,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: MZ.green },

  sectionTitle: {
    color: MZ.navy,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 4,
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  statCard: {
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "32%",
    backgroundColor: MZ.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 11,
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: MZ.navy, fontSize: 20, fontWeight: "900" },
  statLabel: {
    color: MZ.navy,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  statSub: { color: MZ.muted, fontSize: 9, textAlign: "center" },

  card: {
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  settingRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: { color: MZ.green, fontSize: 20, fontWeight: "900" },
  rowTitle: {
    color: MZ.navy,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  rowDescription: {
    color: MZ.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
    marginTop: 3,
  },
  separator: { height: 1, backgroundColor: MZ.border },

  securityRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  retentionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 10,
    paddingTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
  },
  chipActive: { backgroundColor: MZ.green, borderColor: MZ.green },
  chipText: { color: MZ.navy, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: MZ.white },

  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: MZ.greenSoft,
    borderRadius: 13,
    padding: 11,
  },
  messageText: {
    flex: 1,
    color: MZ.navy,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },

  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF6DD",
    borderRadius: 16,
    padding: 13,
  },
  tipText: {
    flex: 1,
    color: MZ.navy,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
  },
  footer: { color: "#98A4B5", fontSize: 11, textAlign: "center", marginTop: 3 },

  pinBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,37,63,0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  pinCard: {
    width: "100%",
    backgroundColor: MZ.white,
    borderRadius: 22,
    padding: 22,
    gap: 13,
  },
  pinTitle: {
    color: MZ.navy,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  pinHint: { color: MZ.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  pinInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MZ.border,
    color: MZ.navy,
    fontSize: 26,
    letterSpacing: 9,
    backgroundColor: MZ.bg,
  },
  pinActions: { flexDirection: "row", gap: 9 },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: MZ.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: MZ.muted, fontWeight: "800" },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: MZ.white, fontWeight: "900" },
});
