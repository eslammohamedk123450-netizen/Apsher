import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { downloadResultMessage, type DownloadResult } from "@/lib/download";
import { getAutoBackupPath, useApp } from "@/lib/local-store";
import { mergeMazraatyIntoStorage } from "@/lib/mazraaty-store";
import {
  exportSuperNotesBackup,
  importSuperNotesBackup,
} from "@/lib/super-backup";

const C = {
  navy: "#10253F",
  blue: "#2F78C9",
  blueLight: "#EAF3FC",
  orange: "#F59E0B",
  orangeLight: "#FFF6DD",
  bg: "#F6F8FB",
  white: "#FFFFFF",
  muted: "#68768A",
  border: "#DCE4EF",
  green: "#16846E",
  red: "#CF4B4B",
};

const confirmImport = (message: string, action: () => void) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(message)) action();
  } else
    Alert.alert("استرداد نسخة", message, [
      { text: "إلغاء", style: "cancel" },
      { text: "استرداد", onPress: action },
    ]);
};

export default function SettingsScreen() {
  const {
    data,
    autoStatus,
    deviceBackupEnabled,
    enableDeviceBackup,
    pin,
    biometricEnabled,
    exportCurrent,
    exportZip,
    importZip,
    importAsBox,
    mergeData,
    setPin,
    setBiometric,
  } = useApp();
  const router = useRouter();
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const backupPath = getAutoBackupPath();

  const copyBackupPath = async () => {
    if (!backupPath) return;
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard?.writeText(backupPath);
      } else {
        await Share.share({ message: backupPath });
      }
      setMessage("مسار ملف الحفظ جاهز للمشاركة أو النسخ.");
    } catch {
      setMessage("تعذر نسخ المسار.");
    }
  };

  const run = async (label: string, action: () => Promise<DownloadResult>) => {
    setBusy(label);
    setMessage("");
    try {
      const result = await action();
      setMessage(downloadResultMessage(result) ?? "تمت العملية.");
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

  const importBox = async () => {
    setBusy("استيراد صندوق");
    setMessage("");
    try {
      const result = await importAsBox();
      setMessage(
        result
          ? `تم استيراد الملف كصندوق جديد: ${result}`
          : "تم إلغاء الاستيراد.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ملف غير صالح");
    } finally {
      setBusy("");
    }
  };

  const setupDeviceBackup = async () => {
    setBusy("مزامنة الجهاز");
    setMessage("");
    try {
      const enabled = await enableDeviceBackup();
      setMessage(
        enabled
          ? "تم إنشاء ملف Apsher-auto-backup.json. سيتم تحديثه تلقائيًا بعد كل تغيير."
          : "لم يتم اختيار مجلد للنسخة.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تعذر تفعيل مزامنة الملف",
      );
    } finally {
      setBusy("");
    }
  };

  const restore = () =>
    confirmImport(
      "سيتم دمج النسخة التي تختارها مع البيانات الحالية (الأقسام تتطابق بالاسم). هل تريد المتابعة؟",
      async () => {
        setBusy("استرداد");
        try {
          const ok = await importZip();
          setMessage(
            ok
              ? "تم استرداد البيانات والصور ودمجها مع الموجود."
              : "تم إلغاء الاسترداد.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "ملف ZIP غير صالح",
          );
        } finally {
          setBusy("");
        }
      },
    );

  const exportAll = async () => {
    setBusy("تصدير الكل");
    setMessage("");
    try {
      const result = await exportSuperNotesBackup();
      setMessage(downloadResultMessage(result) ?? "تم إنشاء نسخة كل المنظومات.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر التصدير");
    } finally {
      setBusy("");
    }
  };

  const restoreAll = () =>
    confirmImport(
      "سيتم دمج بيانات أبشر ومزرعتي من النسخة المختارة مع بياناتك الحالية. هل تريد المتابعة؟",
      async () => {
        setBusy("استرداد الكل");
        setMessage("");
        try {
          const result = await importSuperNotesBackup();
          if (!result) {
            setMessage("تم إلغاء الاسترداد.");
            return;
          }
          if (result.apsher) await mergeData(result.apsher);
          if (result.mazraaty)
            await mergeMazraatyIntoStorage(
              result.mazraaty as Parameters<
                typeof mergeMazraatyIntoStorage
              >[0],
            );
          const systems = [
            result.apsher ? "أبشر" : null,
            result.mazraaty ? "مزرعتي" : null,
          ]
            .filter(Boolean)
            .join(" + ");
          setMessage(
            `تم استرداد ودمج: ${systems}.${
              result.mazraaty
                ? " أعد فتح التطبيق أو انتقل إلى مزرعتي لرؤية بياناتها."
                : ""
            }`,
          );
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "ملف غير صالح");
        } finally {
          setBusy("");
        }
      },
    );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>إدارة التطبيق</Text>
            <Text style={styles.title}>الإعدادات والنسخ</Text>
            <Text style={styles.subtitle}>
              بياناتك محلية، وتستطيع نقلها في أي وقت إلى جهاز آخر.
            </Text>
          </View>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
          />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color={C.green}
            />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.statusTitle}>الحفظ التلقائي نشط</Text>
            <Text style={styles.statusText}>{autoStatus}</Text>
          </View>
          <View style={styles.dot} />
        </View>

        <View style={styles.pathCard}>
          <View style={styles.pathHead}>
            <Ionicons name="folder-open-outline" size={18} color={C.blue} />
            <Text style={styles.pathTitle}>مسار ملف الحفظ التلقائي</Text>
          </View>
          <Text style={styles.pathValue} selectable>
            {backupPath ?? "غير متاح على المتصفح"}
          </Text>
          <Text style={styles.pathHint}>
            كل تغيير (قسم/منتج/تعديل/ملاحظة) يُحفظ فورًا داخل التطبيق، ويُحدَّث
            هذا الملف خلال لحظات.{" "}
            {deviceBackupEnabled
              ? "كما تُكتب نسخة في المجلد المشترك الذي اخترته."
              : "وللاحتفاظ بنسخة تفتحها من مدير الملفات، فعّل «مزامنة ملف على الجهاز» أدناه."}
          </Text>
          {backupPath ? (
            <Pressable
              style={({ pressed }) => [
                styles.pathBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => void copyBackupPath()}
            >
              <Ionicons name="copy-outline" size={15} color={C.blue} />
              <Text style={styles.pathBtnText}>نسخ المسار</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>المنظومات</Text>
        <View style={styles.card}>
          <SettingRow
            icon="grid-outline"
            title="الرجوع إلى المنظومات"
            description="عد إلى شاشة اختيار المنظومات أو افتح منظومة أخرى"
            onPress={() => router.replace("/")}
            busy={false}
          />
        </View>

        <Text style={styles.sectionTitle}>الأرشيف والمحذوفات</Text>
        <View style={styles.card}>
          <SettingRow
            icon="archive-outline"
            title="الأرشيف"
            description="الأقسام والمنتجات والصناديق المؤرشفة، مع إمكانية الاستعادة"
            onPress={() => router.push("/apsher/archive")}
            busy={false}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="trash-outline"
            title="المحذوفات"
            description="الاستعادة أو الحذف النهائي"
            onPress={() => router.push("/apsher/trash")}
            busy={false}
          />
        </View>

        <Text style={styles.sectionTitle}>النسخ الاحتياطي</Text>
        <View style={styles.card}>
          <SettingRow
            icon="layers-outline"
            title="تصدير نسخة كاملة (كل المنظومات)"
            description="ملف واحد فيه أبشر ومزرعتي مع الصور والتسجيلات"
            onPress={() => void exportAll()}
            busy={busy === "تصدير الكل"}
            accent
          />
          <View style={styles.separator} />
          <SettingRow
            icon="cloud-upload-outline"
            title="استرداد النسخة الكاملة"
            description="يستعيد أبشر ومزرعتي من ملف واحد بعد تأكيد"
            onPress={restoreAll}
            busy={busy === "استرداد الكل"}
            accent
          />
          <View style={styles.separator} />
          <SettingRow
            icon="download-outline"
            title="تصدير النسخة الحالية"
            description="ملف JSON واضح يمكن حفظه أو مشاركته الآن"
            onPress={() => void run("تصدير", exportCurrent)}
            busy={busy === "تصدير"}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="sync-outline"
            title={
              deviceBackupEnabled
                ? "مزامنة ملف أبشر مفعلة"
                : "تفعيل ملف مزامنة على الجهاز"
            }
            description={
              deviceBackupEnabled
                ? "يُحدّث Apsher-auto-backup.json تلقائيًا في المجلد المختار"
                : "اختر مجلدًا مشتركًا ليبقى الملف بعد حذف التطبيق"
            }
            onPress={() => void setupDeviceBackup()}
            busy={busy === "مزامنة الجهاز"}
            accent
          />
          <View style={styles.separator} />
          <SettingRow
            icon="archive-outline"
            title="تصدير كل البيانات ZIP"
            description="يشمل الأقسام والمنتجات والصور وسجل المستهلك"
            onPress={() => void run("ZIP", exportZip)}
            busy={busy === "ZIP"}
            accent
          />
          <View style={styles.separator} />
          <SettingRow
            icon="cloud-upload-outline"
            title="استرداد نسخة JSON أو ZIP"
            description="استيراد نسخة من هذا الجهاز أو جهاز آخر"
            onPress={restore}
            busy={busy === "استرداد"}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="file-tray-full-outline"
            title="استيراد أي ملف كصندوق"
            description="أي ملف ZIP أو JSON يتحول إلى صندوق جديد بمنتجاته"
            onPress={() => void importBox()}
            busy={busy === "استيراد صندوق"}
          />
        </View>
        {message ? (
          <View style={styles.message}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={C.blue}
            />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>حماية الوصول</Text>
        <View style={styles.card}>
          <View style={styles.securityRow}>
            <View style={styles.securityIcon}>
              <Ionicons name="keypad-outline" size={21} color={C.blue} />
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.rowTitle}>
                {pin ? "الرقم السري مفعل" : "تفعيل رقم سري"}
              </Text>
              <Text style={styles.rowDescription}>
                {pin
                  ? "سيطلب التطبيق الرقم عند فتحه"
                  : "حماية اختيارية لفتح التطبيق"}
              </Text>
            </View>
            <Switch
              value={Boolean(pin)}
              onValueChange={(value) =>
                value ? setPinModal(true) : void disablePin()
              }
              trackColor={{ false: "#CBD5E1", true: "#9DC5ED" }}
              thumbColor={pin ? C.blue : "#F8FAFC"}
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
                    color={C.blue}
                  />
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={styles.rowTitle}>فتح بالبصمة</Text>
                  <Text style={styles.rowDescription}>
                    يعمل إذا كانت بصمة الجهاز مفعلة
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={(value) => void setBiometric(value)}
                  trackColor={{ false: "#CBD5E1", true: "#9DC5ED" }}
                  thumbColor={biometricEnabled ? C.blue : "#F8FAFC"}
                />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={21} color={C.orange} />
          <Text style={styles.tipText}>
            للاحتفاظ بالبيانات بعد حذف التطبيق، فعّل ملف المزامنة واختر مجلدًا
            مشتركًا مثل Downloads. بعد إعادة التثبيت اختر استرداد JSON أو ZIP؛
            صلاحيات Android لا تسمح للتطبيق بقراءة ملفاتك المشتركة دون اختيارك.
          </Text>
        </View>
        <Text style={styles.footer}>
          أبشر · {data.sections.length} أقسام · {data.products.length} منتجات
        </Text>

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
                أدخل من 4 إلى 8 أرقام لحماية فتح التطبيق.
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
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({
  icon,
  title,
  description,
  onPress,
  busy,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  busy: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.78 }]}
      onPress={onPress}
    >
      <View
        style={[styles.rowIcon, accent && { backgroundColor: C.orangeLight }]}
      >
        {busy ? (
          <Text style={styles.busy}>…</Text>
        ) : (
          <Ionicons name={icon} size={21} color={accent ? C.orange : C.blue} />
        )}
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-back" size={19} color="#8E9BAD" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 50,
    gap: 16,
    backgroundColor: C.bg,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { color: C.blue, fontSize: 12, fontWeight: "800", marginBottom: 4 },
  title: { color: C.navy, fontSize: 25, fontWeight: "900", textAlign: "right" },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginTop: 5,
  },
  logo: { width: 66, height: 66, borderRadius: 19 },
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
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  statusText: {
    color: C.green,
    fontSize: 11,
    textAlign: "right",
    marginTop: 3,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green },
  pathCard: {
    backgroundColor: C.blueLight,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#CFE2F6",
  },
  pathHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  pathTitle: { color: C.navy, fontSize: 14, fontWeight: "900" },
  pathValue: {
    color: C.navy,
    fontSize: 12,
    textAlign: "left",
    backgroundColor: C.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D5E4F5",
  },
  pathHint: { color: C.muted, fontSize: 11, textAlign: "right", lineHeight: 17 },
  pathBtn: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#BFD8F0",
  },
  pathBtnText: { color: C.blue, fontSize: 12, fontWeight: "800" },
  sectionTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 2,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  settingRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: { color: C.blue, fontSize: 22, fontWeight: "900" },
  rowTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  rowDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
    marginTop: 3,
  },
  separator: { height: 1, backgroundColor: C.border },
  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.blueLight,
    borderRadius: 13,
    padding: 11,
  },
  messageText: {
    flex: 1,
    color: C.navy,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  securityRow: {
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  retentionBlock: { paddingVertical: 13, gap: 3 },
  retentionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { color: C.navy, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: C.white },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.orangeLight,
    borderRadius: 16,
    padding: 13,
  },
  tipText: {
    flex: 1,
    color: C.navy,
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
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 22,
    gap: 13,
  },
  pinTitle: {
    color: C.navy,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  pinHint: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  pinInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    color: C.navy,
    fontSize: 26,
    letterSpacing: 9,
    backgroundColor: C.bg,
  },
  pinActions: { flexDirection: "row", gap: 9 },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: C.muted, fontWeight: "800" },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: C.white, fontWeight: "900" },
});
