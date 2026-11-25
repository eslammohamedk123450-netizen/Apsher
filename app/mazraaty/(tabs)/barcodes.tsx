import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Barcode, getCode128Bits } from "@/components/barcode";
import { AppHeader } from "@/components/mazraaty/app-header";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import {
  findMazraatyBarcodeMatch,
  findMazraatyBarcodeMatchFromScan,
  findMazraatyByName,
  type MazraatyBarcodeMatch,
} from "@/lib/barcode-lookup";
import { decodeBarcodeFromImage, pickBarcodeImage } from "@/lib/barcode-image";
import { useMazraaty } from "@/lib/mazraaty-store";

type Entry = {
  id: string;
  type: "section" | "item";
  name: string;
  barcode: string;
  description?: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function pdfBars(value: string) {
  const bits = getCode128Bits(value);
  if (!bits) return "";
  const bars: string[] = [];
  let start = -1;
  for (let index = 0; index <= bits.length; index += 1) {
    if (bits[index] === "1" && start < 0) start = index;
    if (bits[index] !== "1" && start >= 0) {
      bars.push(
        `<rect x="${start + 10}" y="4" width="${index - start}" height="92" fill="#111"/>`,
      );
      start = -1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bits.length + 20}" height="100" viewBox="0 0 ${bits.length + 20} 100" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${bars.join("")}</svg>`;
}

export default function MazraatyBarcodesScreen() {
  const router = useRouter();
  const { data } = useMazraaty();
  const [kind, setKind] = useState<"all" | "section" | "item">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [printMode, setPrintMode] = useState<"single" | "grid">("grid");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualFeedback, setManualFeedback] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanHandled = useRef(false);
  const lastUnknownRef = useRef({ value: "", at: 0 });

  const entries = useMemo<Entry[]>(() => {
    const sections: Entry[] =
      kind === "item"
        ? []
        : data.sections
            .filter((section) => section.barcode && !section.archivedAt)
            .map((section) => ({
              id: `section-${section.id}`,
              type: "section" as const,
              name: section.name,
              barcode: section.barcode!,
            }));
    const items: Entry[] =
      kind === "section"
        ? []
        : data.items
            .filter((item) => !item.archivedAt)
            .map((item) => ({
              id: `item-${item.id}`,
              type: "item" as const,
              name: item.name,
              barcode: item.barcode,
              description:
                data.sections.find((s) => s.id === item.sectionId)?.name ?? "",
            }));
    const query = search.trim().toLocaleLowerCase();
    return [...sections, ...items].filter((entry) =>
      [entry.name, entry.barcode, entry.description ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [data.sections, data.items, kind, search]);

  const sectionCount = data.sections.filter(
    (s) => s.barcode && !s.archivedAt,
  ).length;
  const itemCount = data.items.filter((i) => !i.archivedAt).length;

  const selectedEntries = selected.length
    ? entries.filter((entry) => selected.includes(entry.id))
    : entries;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );

  const switchKind = (next: "all" | "section" | "item") => {
    if (next !== kind) {
      setKind(next);
      setSelected([]);
      setSearch("");
    }
  };

  const exportPdf = async () => {
    if (!selectedEntries.length) return;
    const cards = selectedEntries
      .map(
        (entry) =>
          `<article class="card"><h2>${escapeHtml(entry.name)}</h2><p>${entry.type === "section" ? "قسم" : "عنصر"}</p><div class="bars">${pdfBars(entry.barcode)}</div><strong>${escapeHtml(entry.barcode)}</strong></article>`,
      )
      .join("");
    const html = `<html dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial;padding:20px;color:#10253F}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.card{text-align:center;border:1px solid #DCE4EF;border-radius:12px;padding:20px;break-inside:avoid;${printMode === "single" ? "page-break-after:always;min-height:90vh;display:flex;flex-direction:column;justify-content:center;" : ""}}h2{font-size:24px;margin:4px}.card p{color:#178A5A}.bars{width:100%;height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:18px 0;border:1px solid #DCE4EF;border-radius:10px;background:#fff}.bars svg{max-width:100%;height:90px}strong{font-size:15px;letter-spacing:2px}</style></head><body><main class="sheet">${cards}</main></body></html>`;
    const result = await Print.printToFileAsync({ html });
    if (
      Platform.OS !== "web" &&
      result.uri &&
      (await Sharing.isAvailableAsync())
    )
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: "تصدير باركود مزرعتي",
      });
  };

  const openScanner = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "المسح بالكاميرا",
        "المسح بالكاميرا متاح داخل نسخة Android أو iOS.",
      );
      return;
    }
    if (!permission?.granted) await requestPermission();
    scanHandled.current = false;
    lastUnknownRef.current = { value: "", at: 0 };
    setScanFeedback("");
    setScannerOpen(true);
  };

  /** ينتقل مباشرة إلى القسم أو العنصر المطابق. */
  const navigateToMatch = (match: MazraatyBarcodeMatch) => {
    if (match.type === "section")
      router.navigate({
        pathname: "/mazraaty/section/[id]",
        params: { id: match.sectionId },
      });
    else
      router.navigate({
        pathname: "/mazraaty/item/[id]",
        params: { id: match.itemId },
      });
  };

  const onScan = (result: BarcodeScanningResult) => {
    if (scanHandled.current) return;
    const match = findMazraatyBarcodeMatchFromScan(data, result);
    if (match) {
      scanHandled.current = true;
      setScannerOpen(false);
      navigateToMatch(match);
      return;
    }
    const value = [result.data, result.raw]
      .filter((item, index, all) => Boolean(item) && all.indexOf(item) === index)
      .join(" · ");
    const currentTime = Date.now();
    if (
      lastUnknownRef.current.value !== value ||
      currentTime - lastUnknownRef.current.at > 1500
    ) {
      lastUnknownRef.current = { value, at: currentTime };
      setScanFeedback(
        `قرأت ${result.type} غير مسجل: ${value || "قيمة فارغة"}. وجّه الكاميرا إلى باركود العنصر أو القسم.`,
      );
    }
  };

  /** يقرأ باركودًا من صورة في المعرض ثم ينتقل للمطابق. */
  const scanFromImage = async () => {
    try {
      setImageBusy(true);
      setManualFeedback("");
      const uri = await pickBarcodeImage();
      if (!uri) return;
      const code = await decodeBarcodeFromImage(uri);
      if (!code) {
        setManualFeedback("لم أجد باركودًا واضحًا في الصورة. جرّب صورة أوضح.");
        return;
      }
      setManualCode(code);
      const match =
        findMazraatyBarcodeMatch(data, code) ?? findMazraatyByName(data, code);
      if (!match) {
        setManualFeedback(`قرأت «${code}» لكنه غير مسجّل.`);
        return;
      }
      setManualFeedback("");
      setManualCode("");
      navigateToMatch(match);
    } catch (error) {
      setManualFeedback(
        error instanceof Error ? error.message : "تعذر قراءة الصورة.",
      );
    } finally {
      setImageBusy(false);
    }
  };

  /** تحقق يدوي من باركود أو اسم مكتوب ثم الانتقال للقسم أو العنصر المطابق. */
  const verifyManualCode = () => {
    const value = manualCode.trim();
    const match =
      findMazraatyBarcodeMatch(data, value) ?? findMazraatyByName(data, value);
    if (!match) {
      setManualFeedback("لا يوجد قسم أو عنصر بهذا الباركود أو الاسم.");
      return;
    }
    setManualFeedback("");
    setManualCode("");
    navigateToMatch(match);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <AppHeader
          title="الباركود"
          subtitle="باركود تلقائي للعناصر واختياري للأقسام"
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filters}>
            <Pressable
              onPress={() => switchKind("all")}
              style={[styles.filter, kind === "all" && styles.filterActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  kind === "all" && styles.filterTextActive,
                ]}
              >
                الكل ({sectionCount + itemCount})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchKind("section")}
              style={[styles.filter, kind === "section" && styles.filterActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  kind === "section" && styles.filterTextActive,
                ]}
              >
                الأقسام ({sectionCount})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchKind("item")}
              style={[styles.filter, kind === "item" && styles.filterActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  kind === "item" && styles.filterTextActive,
                ]}
              >
                العناصر ({itemCount})
              </Text>
            </Pressable>
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={20} color={MZ.green} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث بالاسم أو الباركود"
              placeholderTextColor="#8D9AAF"
              style={styles.searchInput}
              textAlign="right"
            />
            <Pressable onPress={openScanner} accessibilityLabel="مسح بالكاميرا">
              <Ionicons name="scan-outline" size={22} color={MZ.green} />
            </Pressable>
          </View>

          <View style={styles.verifyBox}>
            <Text style={styles.verifyLabel}>
              تحقق أو ابحث بالاسم / الباركود
            </Text>
            <View style={styles.verifyRow}>
              <TextInput
                value={manualCode}
                onChangeText={(value) => {
                  setManualCode(value);
                  if (manualFeedback) setManualFeedback("");
                }}
                placeholder="اكتب الباركود أو الاسم ثم تحقق"
                placeholderTextColor="#8D9AAF"
                autoCapitalize="characters"
                onSubmitEditing={verifyManualCode}
                style={styles.verifyInput}
                textAlign="right"
              />
              <Pressable
                style={styles.verifyBtn}
                onPress={verifyManualCode}
                accessibilityLabel="تحقق"
              >
                <Ionicons name="navigate-outline" size={18} color={MZ.white} />
                <Text style={styles.verifyBtnText}>تحقق</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.imageScanBtn}
              onPress={() => void scanFromImage()}
              disabled={imageBusy}
              accessibilityLabel="قراءة باركود من صورة"
            >
              {imageBusy ? (
                <ActivityIndicator size="small" color={MZ.green} />
              ) : (
                <Ionicons name="images-outline" size={18} color={MZ.green} />
              )}
              <Text style={styles.imageScanText}>قراءة من صورة</Text>
            </Pressable>
            {manualFeedback ? (
              <Text style={styles.verifyFeedback}>{manualFeedback}</Text>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.primary} onPress={exportPdf}>
              <Ionicons name="document-text-outline" size={20} color={MZ.white} />
              <Text style={styles.primaryText}>
                تصدير PDF ({selectedEntries.length})
              </Text>
            </Pressable>
            <Pressable
              style={styles.outline}
              onPress={() =>
                setSelected(
                  selected.length === entries.length
                    ? []
                    : entries.map((entry) => entry.id),
                )
              }
            >
              <Text style={styles.outlineText}>
                {selected.length === entries.length
                  ? "إلغاء الكل"
                  : "تحديد الكل"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>طريقة الطباعة:</Text>
            <Pressable
              onPress={() => setPrintMode("grid")}
              style={[styles.mode, printMode === "grid" && styles.modeActive]}
            >
              <Text style={styles.modeText}>عدة في الصفحة</Text>
            </Pressable>
            <Pressable
              onPress={() => setPrintMode("single")}
              style={[styles.mode, printMode === "single" && styles.modeActive]}
            >
              <Text style={styles.modeText}>صفحة لكل باركود</Text>
            </Pressable>
          </View>

          {entries.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => toggle(entry.id)}
              style={[
                styles.card,
                selected.includes(entry.id) && styles.cardSelected,
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  selected.includes(entry.id) && styles.checkboxSelected,
                ]}
              >
                {selected.includes(entry.id) ? (
                  <Ionicons name="checkmark" size={16} color={MZ.white} />
                ) : null}
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardName}>{entry.name}</Text>
                <Text style={styles.cardType}>
                  {entry.type === "section" ? "قسم" : "عنصر"}
                </Text>
                <Text style={styles.cardCode}>{entry.barcode}</Text>
                <View style={styles.barcodeWrap}>
                  <Barcode
                    value={entry.barcode}
                    format="CODE128"
                    height={54}
                    maxWidth={250}
                  />
                </View>
              </View>
            </Pressable>
          ))}

          {!entries.length ? (
            <View style={styles.empty}>
              <Ionicons name="barcode-outline" size={40} color={MZ.green} />
              <Text style={styles.emptyTitle}>لا توجد باركودات</Text>
              <Text style={styles.emptyText}>
                العناصر تُولّد باركودًا تلقائيًا، ويمكنك إضافة باركود اختياري
                للقسم من صفحة تعديله.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "code128",
                "code39",
                "code93",
                "qr",
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "itf14",
                "codabar",
                "pdf417",
                "aztec",
                "datamatrix",
              ],
            }}
            onBarcodeScanned={onScan}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>وجّه الكاميرا إلى الباركود</Text>
            {scanFeedback ? (
              <Text style={styles.scanFeedback}>{scanFeedback}</Text>
            ) : null}
            <Pressable
              style={styles.closeScanner}
              onPress={() => setScannerOpen(false)}
            >
              <Text style={styles.primaryText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  filters: { flexDirection: "row", gap: 8 },
  filter: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
    alignItems: "center",
  },
  filterActive: { backgroundColor: MZ.green, borderColor: MZ.green },
  filterText: { color: MZ.navy, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: MZ.white },
  search: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 15,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, color: MZ.navy, fontSize: 14, paddingVertical: 9 },
  verifyBox: {
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  verifyLabel: {
    color: MZ.navy,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyInput: {
    flex: 1,
    minHeight: 46,
    backgroundColor: MZ.bg,
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: MZ.navy,
    fontSize: 14,
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: MZ.green,
  },
  verifyBtnText: { color: MZ.white, fontSize: 13, fontWeight: "900" },
  imageScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MZ.green,
    backgroundColor: MZ.greenSoft,
  },
  imageScanText: { color: MZ.green, fontSize: 13, fontWeight: "800" },
  verifyFeedback: {
    color: MZ.danger,
    fontSize: 12,
    textAlign: "right",
  },
  actionRow: { flexDirection: "row", gap: 9 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryText: { color: MZ.white, fontSize: 13, fontWeight: "900" },
  outline: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: MZ.green, fontSize: 12, fontWeight: "800" },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  modeLabel: { color: MZ.navy, fontSize: 12, fontWeight: "800" },
  mode: {
    borderRadius: 10,
    backgroundColor: MZ.white,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: MZ.border,
  },
  modeActive: { borderColor: MZ.green, backgroundColor: MZ.greenSoft },
  modeText: { color: MZ.navy, fontSize: 10, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: MZ.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 11,
  },
  cardSelected: { borderColor: MZ.green, backgroundColor: MZ.greenSoft },
  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MZ.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: MZ.green, borderColor: MZ.green },
  cardCopy: { flex: 1, alignItems: "flex-end" },
  cardName: { color: MZ.navy, fontSize: 15, fontWeight: "900" },
  cardType: { color: MZ.green, fontSize: 11, fontWeight: "800", marginTop: 2 },
  cardCode: { color: MZ.muted, fontSize: 10, letterSpacing: 1, marginTop: 3 },
  barcodeWrap: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: MZ.white,
    marginTop: 9,
    padding: 8,
    borderRadius: 10,
  },
  empty: {
    alignItems: "center",
    backgroundColor: MZ.white,
    padding: 28,
    borderRadius: 18,
    gap: 8,
  },
  emptyTitle: { color: MZ.navy, fontSize: 17, fontWeight: "900" },
  emptyText: { color: MZ.muted, textAlign: "center", lineHeight: 20 },
  scanner: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 70,
    paddingBottom: 50,
  },
  scannerTitle: {
    color: MZ.white,
    fontSize: 17,
    fontWeight: "900",
    backgroundColor: "rgba(0,0,0,.55)",
    padding: 14,
    borderRadius: 14,
  },
  scanFeedback: {
    color: MZ.white,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,.72)",
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeScanner: {
    minWidth: 140,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
