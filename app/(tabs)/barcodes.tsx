import { CameraView, useCameraPermissions } from "expo-camera";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Barcode } from "@/components/barcode";
import { useApp } from "@/lib/local-store";

const C = { navy: "#10253F", blue: "#2F78C9", blueLight: "#EAF3FC", bg: "#F6F8FB", white: "#FFFFFF", muted: "#68768A", border: "#DCE4EF", orange: "#F59E0B", green: "#16846E" };

type Entry = { id: string; type: "product" | "box"; name: string; barcode: string; description?: string };

function pdfBars(value: string) {
  return Array.from(value).map((char, index) => `<i style="display:inline-block;width:${(char.charCodeAt(0) % 3) + 1}px;height:82px;background:#111;margin-right:1px"></i>${index % 3 === 0 ? `<i style="display:inline-block;width:2px;height:82px;background:white"></i>` : ""}`).join("");
}

export default function BarcodesScreen() {
  const { data } = useApp();
  const [kind, setKind] = useState<"product" | "box">("product");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [printMode, setPrintMode] = useState<"single" | "grid">("grid");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const entries = useMemo<Entry[]>(() => (kind === "product"
    ? [
        ...data.products.map((item) => ({ id: `product-${item.id}`, type: "product" as const, name: item.name, barcode: item.barcode, description: item.description })),
        ...data.boxes.flatMap((box) => box.items.map((item) => ({ id: `box-item-${box.id}-${item.id}`, type: "product" as const, name: item.productName, barcode: item.barcode, description: [item.description, box.name ? `داخل ${box.name}` : "داخل صندوق"].filter(Boolean).join(" · ") }))),
      ]
    : data.boxes.map((item) => ({ id: item.id, type: "box" as const, name: item.name || "صندوق بدون اسم", barcode: item.barcode, description: item.description }))
  ).filter((item) => [item.name, item.barcode, item.description ?? ""].some((value) => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [data.products, data.boxes, kind, search]);

  const switchKind = (next: "product" | "box") => { if (next !== kind) { setKind(next); setSelected([]); setSearch(""); } };

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectedEntries = selected.length ? entries.filter((entry) => selected.includes(entry.id)) : entries;

  const exportPdf = async () => {
    if (!selectedEntries.length) return;
    const cards = selectedEntries.map((entry) => `<article class="card"><h2>${entry.name}</h2><p>${entry.type === "box" ? "صندوق" : "منتج"}</p><div class="bars">${pdfBars(entry.barcode)}</div><strong>${entry.barcode}</strong></article>`).join("");
    const html = `<html dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial;padding:20px;color:#10253F}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.card{text-align:center;border:1px solid #DCE4EF;border-radius:12px;padding:20px;${printMode === "single" ? "page-break-after:always;min-height:90vh;display:flex;flex-direction:column;justify-content:center;" : ""}}h2{font-size:24px;margin:4px}.card p{color:#2F78C9}.bars{height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:18px 0}.bars i{flex:none}strong{font-size:15px;letter-spacing:2px}</style></head><body><main class="sheet">${cards}</main></body></html>`;
    const result = await Print.printToFileAsync({ html });
    if (Platform.OS !== "web" && result.uri && await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "تصدير باركود أبشر" });
  };

  const openScanner = async () => {
    if (Platform.OS === "web") { Alert.alert("المسح بالكاميرا", "المسح بالكاميرا متاح داخل نسخة Android أو iOS."); return; }
    if (!permission?.granted) await requestPermission();
    setScannerOpen(true);
  };

  const onScan = ({ data: value }: { data: string }) => {
    const scanned = value.trim();
    const foundProduct = data.products.find((item) => item.barcode === scanned);
    const foundBoxItem = data.boxes.flatMap((box) => box.items).find((item) => item.barcode === scanned);
    const foundBox = data.boxes.find((item) => item.barcode === scanned);
    const foundKind = foundBox ? "box" : foundProduct || foundBoxItem ? "product" : null;
    if (foundKind) setKind(foundKind);
    setSelected([]);
    setSearch(scanned);
    setScannerOpen(false);
    if (!foundKind) Alert.alert("باركود غير معروف", "هذا الباركود غير مسجل في التطبيق.");
  };

  return <ScreenContainer><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>هوية المخزون</Text><Text style={styles.title}>الباركود</Text><Text style={styles.subtitle}>باركود تلقائي للمنتجات والصناديق مع طباعة مرنة.</Text></View><View style={styles.icon}><Ionicons name="barcode-outline" size={30} color={C.blue} /></View></View>
    <View style={styles.filters}><Pressable onPress={() => switchKind("product")} style={[styles.filter, kind === "product" && styles.filterActive]}><Ionicons name="cube-outline" size={18} color={kind === "product" ? C.white : C.blue} /><Text style={[styles.filterText, kind === "product" && styles.filterTextActive]}>المنتجات ({data.products.length})</Text></Pressable><Pressable onPress={() => switchKind("box")} style={[styles.filter, kind === "box" && styles.filterBoxActive]}><Ionicons name="file-tray-full-outline" size={18} color={kind === "box" ? C.white : C.orange} /><Text style={[styles.filterText, kind === "box" && styles.filterTextActive]}>الصناديق ({data.boxes.length})</Text></Pressable></View>
    <View style={styles.search}><Ionicons name="search" size={20} color={C.blue} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو الباركود" placeholderTextColor="#8D9AAF" style={styles.searchInput} textAlign="right" /><Pressable onPress={openScanner}><Ionicons name="scan-outline" size={22} color={C.blue} /></Pressable></View>
    <View style={styles.actionRow}><Pressable style={styles.primary} onPress={exportPdf}><Ionicons name="document-text-outline" size={20} color={C.white} /><Text style={styles.primaryText}>تصدير PDF ({selectedEntries.length})</Text></Pressable><Pressable style={styles.outline} onPress={() => setSelected(selected.length === entries.length ? [] : entries.map((entry) => entry.id))}><Text style={styles.outlineText}>{selected.length === entries.length ? "إلغاء الكل" : "تحديد الكل"}</Text></Pressable></View>
    <View style={styles.modeRow}><Text style={styles.modeLabel}>طريقة الطباعة:</Text><Pressable onPress={() => setPrintMode("grid")} style={[styles.mode, printMode === "grid" && styles.modeActive]}><Text style={styles.modeText}>عدة في الصفحة</Text></Pressable><Pressable onPress={() => setPrintMode("single")} style={[styles.mode, printMode === "single" && styles.modeActive]}><Text style={styles.modeText}>صفحة لكل باركود</Text></Pressable></View>
    {entries.map((entry) => <Pressable key={`${entry.type}-${entry.id}`} onPress={() => toggle(entry.id)} style={[styles.card, selected.includes(entry.id) && styles.cardSelected]}><View style={[styles.checkbox, selected.includes(entry.id) && styles.checkboxSelected]}>{selected.includes(entry.id) ? <Ionicons name="checkmark" size={16} color={C.white} /> : null}</View><View style={styles.cardCopy}><Text style={styles.cardName}>{entry.name}</Text><Text style={styles.cardType}>{entry.type === "box" ? "صندوق" : "منتج"}</Text><Text style={styles.cardCode}>{entry.barcode}</Text><View style={styles.barcodeWrap}><Barcode value={entry.barcode} format="CODE128" height={54} maxWidth={250} /></View></View></Pressable>)}
    {!entries.length ? <View style={styles.empty}><Ionicons name="barcode-outline" size={40} color={C.blue} /><Text style={styles.emptyTitle}>{kind === "product" ? "لا توجد منتجات بباركود" : "لا توجد صناديق بباركود"}</Text><Text style={styles.emptyText}>أضف {kind === "product" ? "منتجًا" : "صندوقًا"} وسيتم إنشاء الباركود تلقائيًا.</Text></View> : null}
  </ScrollView>
  <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}><View style={styles.scanner}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["code128", "qr", "ean13", "ean8", "upc_a"] }} onBarcodeScanned={onScan} /><View style={styles.scannerOverlay}><Text style={styles.scannerTitle}>وجّه الكاميرا إلى الباركود</Text><Pressable style={styles.closeScanner} onPress={() => setScannerOpen(false)}><Text style={styles.primaryText}>إغلاق</Text></Pressable></View></View></Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ container: { padding: 20, paddingTop: 18, paddingBottom: 48, gap: 14, backgroundColor: C.bg }, header: { flexDirection: "row", alignItems: "center", gap: 14 }, headerCopy: { flex: 1, alignItems: "flex-end" }, eyebrow: { color: C.orange, fontSize: 12, fontWeight: "800" }, title: { color: C.navy, fontSize: 28, fontWeight: "900" }, subtitle: { color: C.muted, fontSize: 13, textAlign: "right", lineHeight: 20, marginTop: 5 }, icon: { width: 62, height: 62, borderRadius: 20, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" }, filters: { flexDirection: "row", gap: 8 }, filterActive: { backgroundColor: C.blue, borderColor: C.blue }, filterBoxActive: { backgroundColor: C.orange, borderColor: C.orange }, filterText: { color: C.navy, fontSize: 12, fontWeight: "800" }, filterTextActive: { color: C.white }, filter: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }, search: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 15, paddingHorizontal: 13 }, searchInput: { flex: 1, color: C.navy, fontSize: 14, paddingVertical: 9 }, actionRow: { flexDirection: "row", gap: 9 }, primary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, primaryText: { color: C.white, fontSize: 13, fontWeight: "900" }, outline: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.blue, alignItems: "center", justifyContent: "center" }, outlineText: { color: C.blue, fontSize: 12, fontWeight: "800" }, modeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }, modeLabel: { color: C.navy, fontSize: 12, fontWeight: "800" }, mode: { borderRadius: 10, backgroundColor: C.white, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: C.border }, modeActive: { borderColor: C.orange, backgroundColor: "#FFF6DD" }, modeText: { color: C.navy, fontSize: 10, fontWeight: "700" }, card: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, padding: 11 }, cardSelected: { borderColor: C.blue, backgroundColor: C.blueLight }, checkbox: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }, checkboxSelected: { backgroundColor: C.blue, borderColor: C.blue }, cardCopy: { flex: 1, alignItems: "flex-end" }, cardName: { color: C.navy, fontSize: 15, fontWeight: "900" }, cardType: { color: C.blue, fontSize: 11, fontWeight: "800", marginTop: 2 }, cardCode: { color: C.muted, fontSize: 10, letterSpacing: 1, marginTop: 3 }, barcodeWrap: { alignSelf: "stretch", alignItems: "center", backgroundColor: C.white, marginTop: 9, padding: 8, borderRadius: 10 }, empty: { alignItems: "center", backgroundColor: C.white, padding: 28, borderRadius: 18, gap: 8 }, emptyTitle: { color: C.navy, fontSize: 17, fontWeight: "900" }, emptyText: { color: C.muted, textAlign: "center", lineHeight: 20 }, scanner: { flex: 1, backgroundColor: "#000" }, scannerOverlay: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 70, paddingBottom: 50 }, scannerTitle: { color: C.white, fontSize: 17, fontWeight: "900", backgroundColor: "rgba(0,0,0,.55)", padding: 14, borderRadius: 14 }, closeScanner: { minWidth: 140, minHeight: 48, borderRadius: 14, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" } });
