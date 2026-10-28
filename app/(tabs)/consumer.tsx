import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { formatDate, makeId, Product, useApp } from "@/lib/local-store";

const C = { navy: "#10253F", blue: "#2F78C9", blueLight: "#EAF3FC", orange: "#F59E0B", orangeLight: "#FFF6DD", bg: "#F6F8FB", white: "#FFFFFF", muted: "#68768A", border: "#DCE4EF", red: "#CF4B4B" };

function ModalShell({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={styles.modal}><View style={styles.modalHeader}><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={22} color={C.navy} /></Pressable><Text style={styles.modalTitle}>{title}</Text><View style={{ width: 40 }} /></View><ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">{children}</ScrollView></View></KeyboardAvoidingView></Modal>;
}

export default function ConsumerScreen() {
  const { data, commit } = useApp();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [usageDescription, setUsageDescription] = useState("");

  const term = search.trim().toLocaleLowerCase();
  const records = data.consumerRecords.filter((record) => [record.productSnapshot.name, record.sectionName, record.usageDescription].some((value) => value.toLocaleLowerCase().includes(term)));
  const productTerm = productSearch.trim().toLocaleLowerCase();
  const products = data.products.filter((product) => {
    const section = data.sections.find((item) => item.id === product.sectionId);
    return [product.name, product.description, section?.name ?? ""].some((value) => value.toLocaleLowerCase().includes(productTerm));
  });

  const saveRecord = async () => {
    if (!selectedProduct) {
      Alert.alert("اختر منتجًا", "اختر المنتج الذي تم استهلاكه أولًا.");
      return;
    }
    const sectionName = data.sections.find((section) => section.id === selectedProduct.sectionId)?.name ?? "بدون قسم";
    const addedAt = new Date().toISOString();
    await commit((previous) => ({
      ...previous,
      consumerRecords: [{
        id: makeId("consumer"),
        productId: selectedProduct.id,
        productSnapshot: { ...selectedProduct },
        sectionName,
        usageDescription: usageDescription.trim(),
        consumedAt: addedAt,
        addedAt,
      }, ...previous.consumerRecords],
    }));
    setModalOpen(false);
    setSelectedProduct(null);
    setProductSearch("");
    setUsageDescription("");
  };

  const deleteRecord = (id: string) => {
    const action = () => void commit((previous) => ({ ...previous, consumerRecords: previous.consumerRecords.filter((record) => record.id !== id) }));
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("حذف سجل الاستهلاك؟")) action();
    } else Alert.alert("حذف السجل", "هل تريد حذف هذا السجل؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: action }]);
  };

  return <ScreenContainer><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>سجل الحركة اليومية</Text><Text style={styles.title}>المستهلك</Text><Text style={styles.subtitle}>احتفظ بتفاصيل أين ومتى استُخدمت كل قطعة.</Text></View><View style={styles.headerIcon}><Ionicons name="checkmark-done" size={28} color={C.blue} /></View></View>
    <View style={styles.summary}><View><Text style={styles.summaryNumber}>{data.consumerRecords.length}</Text><Text style={styles.summaryLabel}>سجل محفوظ</Text></View><View style={styles.summaryDivider} /><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.summaryTitle}>كل عملية موثقة</Text><Text style={styles.summaryText}>يتحفظ معها المنتج والقسم والتاريخ والوصف.</Text></View></View>
    <Pressable style={styles.addButton} onPress={() => setModalOpen(true)}><Ionicons name="add-circle-outline" size={22} color={C.white} /><Text style={styles.addButtonText}>إضافة استهلاك</Text></Pressable>
    <View style={styles.searchBox}><Ionicons name="search" size={20} color={C.blue} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث في سجل المستهلك" placeholderTextColor="#8D9AAF" style={styles.searchInput} textAlign="right" />{search ? <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={19} color="#8D9AAF" /></Pressable> : null}</View>
    <View style={styles.listHeader}><Text style={styles.count}>{records.length} سجل</Text><Text style={styles.listTitle}>آخر عمليات الاستهلاك</Text></View>
    {records.length ? records.map((record) => <View key={record.id} style={styles.recordCard}>
      {record.productSnapshot.imageUri ? <Image source={{ uri: record.productSnapshot.imageUri }} style={styles.recordImage} /> : <View style={styles.recordImagePlaceholder}><Ionicons name="cube-outline" size={25} color={C.blue} /></View>}
      <View style={styles.recordCopy}><Text style={styles.recordName}>{record.productSnapshot.name}</Text><Text style={styles.recordSection}>{record.sectionName}</Text><Text style={styles.recordDescription}>{record.usageDescription || "لم تتم إضافة وصف للاستهلاك."}</Text><Text style={styles.recordDate}>{formatDate(record.consumedAt)} · أضيف {formatDate(record.addedAt)}</Text></View>
      <Pressable onPress={() => deleteRecord(record.id)} style={styles.deleteButton}><Ionicons name="trash-outline" size={18} color={C.red} /></Pressable>
    </View>) : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={31} color={C.blue} /></View><Text style={styles.emptyTitle}>لا توجد سجلات بعد</Text><Text style={styles.emptyText}>عند استخدام أي منتج، أضفه هنا لتكوين سجل واضح يمكن الرجوع إليه.</Text></View>}
  </ScrollView>

  <ModalShell visible={modalOpen} title="إضافة استهلاك" onClose={() => setModalOpen(false)}>
    <Text style={styles.modalHint}>ابحث عن المنتج ثم اكتب أين أو كيف تم استهلاكه.</Text>
    <View style={styles.searchBox}><Ionicons name="search" size={19} color={C.blue} /><TextInput value={productSearch} onChangeText={(value) => { setProductSearch(value); setSelectedProduct(null); }} placeholder="ابحث عن منتج" placeholderTextColor="#8D9AAF" style={styles.searchInput} textAlign="right" /></View>
    {!selectedProduct ? <View style={styles.productChoices}>{products.slice(0, 8).map((product) => { const section = data.sections.find((item) => item.id === product.sectionId); return <Pressable key={product.id} style={styles.choice} onPress={() => setSelectedProduct(product)}><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.choiceName}>{product.name}</Text><Text style={styles.choiceSection}>{section?.name ?? "بدون قسم"}</Text></View><Ionicons name="add-circle-outline" size={22} color={C.blue} /></Pressable>; })}{products.length === 0 ? <Text style={styles.noResults}>لا يوجد منتج مطابق.</Text> : null}</View> : <View style={styles.selected}><Ionicons name="checkmark-circle" size={24} color="#16846E" /><View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.choiceName}>{selectedProduct.name}</Text><Text style={styles.choiceSection}>تم اختيار المنتج · اضغط البحث لتغييره</Text></View></View>}
    <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>وصف الاستهلاك</Text><TextInput value={usageDescription} onChangeText={setUsageDescription} placeholder="مثال: تم تركيبه في الورشة رقم 2" placeholderTextColor="#9AA7B8" multiline style={[styles.input, styles.multiline]} textAlign="right" /></View>
    <Pressable style={[styles.addButton, !selectedProduct && { opacity: 0.45 }]} disabled={!selectedProduct} onPress={saveRecord}><Text style={styles.addButtonText}>حفظ سجل الاستهلاك</Text></Pressable>
  </ModalShell>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 18, paddingBottom: 44, gap: 16, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { color: C.orange, fontSize: 12, fontWeight: "800", marginBottom: 4 },
  title: { color: C.navy, fontSize: 28, fontWeight: "900", textAlign: "right" },
  subtitle: { color: C.muted, fontSize: 13, textAlign: "right", marginTop: 5, lineHeight: 20 },
  headerIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" },
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: C.orangeLight, borderColor: "#F6DF9E", borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  summaryNumber: { color: C.navy, fontSize: 27, fontWeight: "900", textAlign: "center" },
  summaryLabel: { color: C.muted, fontSize: 11, textAlign: "center" },
  summaryDivider: { height: 45, width: 1, backgroundColor: "#E7CF8C" },
  summaryTitle: { color: C.navy, fontSize: 14, fontWeight: "800", textAlign: "right" },
  summaryText: { color: C.muted, fontSize: 11, textAlign: "right", marginTop: 3 },
  addButton: { minHeight: 50, borderRadius: 15, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  addButtonText: { color: C.white, fontSize: 14, fontWeight: "900" },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 15, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: C.navy, fontSize: 14, paddingVertical: 9 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listTitle: { color: C.navy, fontSize: 18, fontWeight: "900", textAlign: "right" },
  count: { color: C.muted, fontSize: 12 },
  recordCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, padding: 11 },
  recordImage: { width: 62, height: 62, borderRadius: 13, backgroundColor: C.blueLight },
  recordImagePlaceholder: { width: 62, height: 62, borderRadius: 13, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" },
  recordCopy: { flex: 1, alignItems: "flex-end" },
  recordName: { color: C.navy, fontSize: 15, fontWeight: "900" },
  recordSection: { color: C.blue, fontSize: 11, fontWeight: "800", marginTop: 2 },
  recordDescription: { color: C.muted, fontSize: 12, lineHeight: 17, textAlign: "right", marginTop: 5 },
  recordDate: { color: "#8B97A7", fontSize: 10, textAlign: "right", marginTop: 6 },
  deleteButton: { width: 33, height: 33, borderRadius: 10, backgroundColor: "#FFF1F1", alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 28, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: C.navy, fontSize: 17, fontWeight: "900" },
  emptyText: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 20 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,37,63,0.35)" },
  modal: { maxHeight: "94%", backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 13 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 },
  close: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, alignItems: "center", justifyContent: "center" },
  modalTitle: { color: C.navy, fontSize: 18, fontWeight: "900" },
  modalBody: { padding: 18, gap: 14 },
  modalHint: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  productChoices: { gap: 8 },
  choice: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 12 },
  choiceName: { color: C.navy, fontSize: 14, fontWeight: "900" },
  choiceSection: { color: C.blue, fontSize: 11, marginTop: 3, textAlign: "right" },
  noResults: { color: C.muted, textAlign: "center", padding: 12 },
  selected: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ECF8F3", borderColor: "#CDEBDD", borderWidth: 1, borderRadius: 14, padding: 12 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: C.navy, fontSize: 13, fontWeight: "900", textAlign: "right" },
  input: { backgroundColor: C.white, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, color: C.navy, fontSize: 14 },
  multiline: { minHeight: 94, paddingTop: 13, textAlignVertical: "top" },
});
