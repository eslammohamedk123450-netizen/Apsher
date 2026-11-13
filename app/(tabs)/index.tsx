import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
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
import Svg, { Polygon } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
import { VoiceInput } from "@/components/voice-input";
import { formatDate, makeBarcode, makeId, Product, useApp } from "@/lib/local-store";

const COLORS = {
  navy: "#10253F",
  blue: "#2F78C9",
  blueLight: "#EAF3FC",
  orange: "#F59E0B",
  orangeLight: "#FFF6DD",
  green: "#16846E",
  red: "#CF4B4B",
  bg: "#F6F8FB",
  white: "#FFFFFF",
  muted: "#68768A",
  border: "#DCE4EF",
};

const confirmAction = (title: string, message: string, action: () => void) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(message)) action();
    return;
  }
  Alert.alert(title, message, [
    { text: "إلغاء", style: "cancel" },
    { text: "تأكيد", style: "destructive", onPress: action },
  ]);
};

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{label}</Text><VoiceInput onText={onChangeText} /></View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA7B8"
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        textAlign="right"
      />
    </View>
  );
}

function ModalShell({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="إغلاق">
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </Pressable>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HomeScreen() {
  const { data, ready, autoStatus, commit, pickImage } = useApp();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [sectionModal, setSectionModal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  useEffect(() => {
    if (!productId || !ready) return;
    const product = data.products.find((item) => item.id === productId);
    if (product) { setSectionId(product.sectionId); setDetailProduct(product); }
    router.setParams({ productId: undefined });
  }, [productId, ready, data.products, router]);

  const currentSection = data.sections.find((section) => section.id === sectionId) ?? null;
  const sectionProducts = currentSection ? data.products.filter((product) => product.sectionId === currentSection.id) : [];
  const searchTerm = search.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return data.products.filter((product) => {
      const section = data.sections.find((item) => item.id === product.sectionId);
      return [product.name, product.description, section?.name ?? ""].some((value) => value.toLocaleLowerCase().includes(searchTerm));
    });
  }, [data.products, data.sections, searchTerm]);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductName("");
    setProductDescription("");
    setProductQuantity("1");
    setProductImage(null);
    setProductModal(true);
  };

  const openEditProduct = (product: Product) => {
    setSectionId(product.sectionId);
    setEditingProduct(product);
    setProductName(product.name);
    setProductDescription(product.description);
    setProductQuantity(String(product.quantity));
    setProductImage(product.imageUri ?? null);
    setProductModal(true);
    setDetailProduct(null);
  };

  const saveSection = async () => {
    const clean = sectionName.trim();
    if (!clean) return;
    if (editingSectionId) {
      await commit((previous) => ({ ...previous, sections: previous.sections.map((section) => section.id === editingSectionId ? { ...section, name: clean } : section) }));
    } else {
      await commit((previous) => ({ ...previous, sections: [...previous.sections, { id: makeId("section"), name: clean, createdAt: new Date().toISOString() }] }));
    }
    setSectionName("");
    setEditingSectionId(null);
    setSectionModal(false);
  };

  const saveProduct = async () => {
    const clean = productName.trim();
    const targetSectionId = editingProduct?.sectionId ?? sectionId;
    const quantity = Math.max(0, Math.floor(Number(productQuantity) || 0));
    if (!clean || !targetSectionId) {
      Alert.alert("اختر قسمًا", "افتح المنتج من داخل قسم أو اختر قسمًا قبل الحفظ.");
      return;
    }
    if (editingProduct) {
      await commit((previous) => ({
        ...previous,
        products: previous.products.map((item) => item.id === editingProduct.id ? {
          ...item,
          name: clean,
          description: productDescription.trim(),
          quantity,
          barcode: editingProduct.barcode,
          imageUri: productImage,
          updatedAt: new Date().toISOString(),
        } : item),
      }));
    } else {
      const createdAt = new Date().toISOString();
      await commit((previous) => ({
        ...previous,
        products: [...previous.products, {
          id: makeId("product"),
          sectionId: targetSectionId,
          name: clean,
          description: productDescription.trim(),
          quantity,
          barcode: makeBarcode("product"),
          imageUri: productImage,
          createdAt,
          updatedAt: createdAt,
        }],
      }));
    }
    setProductModal(false);
  };

  const deleteProduct = (product: Product) => {
    confirmAction("حذف المنتج", `هل تريد حذف «${product.name}»؟`, () => {
      void commit((previous) => ({
        ...previous,
        products: previous.products.filter((item) => item.id !== product.id),
      }));
      setDetailProduct(null);
    });
  };

  const deleteSection = (id: string) => {
    const section = data.sections.find((item) => item.id === id);
    if (!section) return;
    confirmAction("حذف القسم", `سيتم حذف القسم ومنتجاته: «${section.name}»`, () => {
      void commit((previous) => ({
        ...previous,
        sections: previous.sections.filter((item) => item.id !== id),
        products: previous.products.filter((item) => item.sectionId !== id),
      }));
      setSectionId(null);
    });
  };

  const chooseImage = async () => {
    try {
      const image = await pickImage();
      if (image) setProductImage(image);
    } catch (error) {
      Alert.alert("الصورة", error instanceof Error ? error.message : "تعذر اختيار الصورة");
    }
  };

  if (!ready) {
    return <ScreenContainer><View style={styles.loading}><ActivityIndicator size="large" color={COLORS.blue} /><Text style={styles.muted}>جاري فتح البيانات المحلية…</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandCopy}>
            <Text style={styles.eyebrow}>دفتر التشغيل المحلي</Text>
            <Text style={styles.title}>كل أدواتك في مكان واحد</Text>
            <Text style={styles.subtitle}>أضف، ابحث، وسجّل الاستهلاك حتى بدون إنترنت.</Text>
          </View>
          <Image source={require("@/assets/images/icon.png")} style={styles.brandIcon} />
        </View>

        <View style={styles.autoBanner}>
          <View style={styles.autoIcon}><Ionicons name="cloud-done-outline" size={20} color={COLORS.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoTitle}>الحفظ التلقائي على الجهاز</Text>
            <Text style={styles.autoText}>{autoStatus}</Text>
          </View>
          <View style={styles.liveDot} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.blue} />
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث في الأقسام والمنتجات والوصف" placeholderTextColor="#8D9AAF" style={styles.searchInput} textAlign="right" />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={19} color="#8D9AAF" /></Pressable> : null}
        </View>

        {searchTerm ? (
          <View style={styles.sectionBlock}>
            <View style={styles.blockHeader}><Text style={styles.blockTitle}>نتائج البحث</Text><Text style={styles.countText}>{searchResults.length} نتيجة</Text></View>
            {searchResults.length ? searchResults.map((product) => {
              const section = data.sections.find((item) => item.id === product.sectionId);
              return <ProductCard key={product.id} product={product} sectionName={section?.name ?? "بدون قسم"} onPress={() => setDetailProduct(product)} onEdit={() => openEditProduct(product)} />;
            }) : <EmptyState icon="search-outline" title="لا توجد نتيجة" text="جرّب اسمًا آخر أو جزءًا من الوصف." />}
          </View>
        ) : currentSection ? (
          <View style={styles.sectionBlock}>
            <View style={styles.detailHeader}>
              <Pressable onPress={() => setSectionId(null)} style={styles.backButton}><Ionicons name="arrow-forward" size={20} color={COLORS.blue} /><Text style={styles.backText}>كل الأقسام</Text></Pressable>
              <View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.blockTitle}>{currentSection.name}</Text><Text style={styles.countText}>{sectionProducts.length} عنصر</Text></View>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={openAddProduct}><Ionicons name="add" size={20} color={COLORS.white} /><Text style={styles.primaryButtonText}>إضافة منتج</Text></Pressable>
              <Pressable style={styles.ghostButton} onPress={() => deleteSection(currentSection.id)}><Ionicons name="trash-outline" size={18} color={COLORS.red} /><Text style={styles.dangerText}>حذف القسم</Text></Pressable>
            </View>
            {sectionProducts.length ? sectionProducts.map((product) => <ProductCard key={product.id} product={product} sectionName={currentSection.name} onPress={() => setDetailProduct(product)} onEdit={() => openEditProduct(product)} />) : <EmptyState icon="cube-outline" title="القسم فارغ" text="أضف أول منتج ليظهر هنا." />}
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard number={data.sections.length} label="الأقسام" icon="layers-outline" />
              <StatCard number={data.products.length} label="المنتجات" icon="cube-outline" />
              <StatCard number={data.consumerRecords.length} label="الاستهلاك" icon="checkmark-done-outline" />
            </View>
            <View style={styles.blockHeader}><Text style={styles.blockTitle}>الأقسام</Text><Pressable style={styles.addSmallButton} onPress={() => { setEditingSectionId(null); setSectionName(""); setSectionModal(true); }}><Ionicons name="add" size={18} color={COLORS.white} /><Text style={styles.addSmallText}>قسم جديد</Text></Pressable></View>
            {data.sections.length ? data.sections.map((section) => <Pressable key={section.id} onPress={() => setSectionId(section.id)} style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}>
              <View style={styles.sectionAccent} />
              <View style={styles.sectionCardContent}>
                <View style={styles.sectionArrow}><Ionicons name="chevron-back" size={20} color={COLORS.blue} /></View>
                <View style={styles.sectionCardText}><Text style={styles.sectionName}>{section.name}</Text><Text style={styles.sectionMeta}>{data.products.filter((product) => product.sectionId === section.id).length} منتج · {data.products.filter((product) => product.sectionId === section.id).reduce((sum, product) => sum + product.quantity, 0)} قطعة متبقية</Text></View>
                <Pressable onPress={(event) => { event.stopPropagation(); setEditingSectionId(section.id); setSectionName(section.name); setSectionModal(true); }} style={styles.editSectionButton}><Ionicons name="create-outline" size={18} color={COLORS.blue} /></Pressable>
                <View style={styles.sectionIcon}><Ionicons name="folder-open-outline" size={23} color={COLORS.blue} /></View>
              </View>
            </Pressable>) : <EmptyState icon="folder-open-outline" title="ابدأ بإضافة أول قسم" text="اجعل أدواتك مرتبة باسم واضح يسهل البحث عنه." actionLabel="إضافة قسم" onAction={() => setSectionModal(true)} />}
          </>
        )}
      </ScrollView>

      <ModalShell visible={sectionModal} title={editingSectionId ? "تعديل القسم" : "إضافة قسم جديد"} onClose={() => setSectionModal(false)}>
        <Text style={styles.modalHint}>اكتب اسمًا قصيرًا وواضحًا للقسم، مثل «عدة» أو «بروستر».</Text>
        <Field label="اسم القسم" value={sectionName} onChangeText={setSectionName} placeholder="مثال: عدة" />
        <Pressable style={[styles.primaryButton, !sectionName.trim() && styles.disabled]} disabled={!sectionName.trim()} onPress={saveSection}><Text style={styles.primaryButtonText}>{editingSectionId ? "حفظ التعديل" : "حفظ القسم"}</Text></Pressable>
      </ModalShell>

      <ModalShell visible={productModal} title={editingProduct ? "تعديل المنتج" : "إضافة منتج"} onClose={() => setProductModal(false)}>
        <Text style={styles.modalHint}>القسم الحالي: {currentSection?.name ?? "غير محدد"}</Text>
        <Field label="اسم المنتج" value={productName} onChangeText={setProductName} placeholder="مثال: مفتاح إنجليزي" />
        <Field label="عدد القطع المتبقية" value={productQuantity} onChangeText={setProductQuantity} placeholder="مثال: 10" />
        <Field label="الوصف" value={productDescription} onChangeText={setProductDescription} placeholder="اكتب وصفًا يساعدك في البحث لاحقًا" multiline />
        <Pressable style={styles.imagePicker} onPress={chooseImage}>
          {productImage ? <Image source={{ uri: productImage }} resizeMode="contain" style={styles.previewImage} /> : <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={28} color={COLORS.blue} /><Text style={styles.imagePickerText}>اختيار صورة من الجهاز</Text></View>}
        </Pressable>
        <Pressable style={[styles.primaryButton, !productName.trim() && styles.disabled]} disabled={!productName.trim()} onPress={saveProduct}><Text style={styles.primaryButtonText}>{editingProduct ? "حفظ التعديل" : "إضافة المنتج"}</Text></Pressable>
      </ModalShell>

      <ModalShell visible={Boolean(detailProduct)} title="تفاصيل المنتج" onClose={() => setDetailProduct(null)}>
        {detailProduct ? <>
          {detailProduct.imageUri ? <Image source={{ uri: detailProduct.imageUri }} resizeMode="contain" style={styles.detailImage} /> : <View style={styles.detailImagePlaceholder}><Ionicons name="cube-outline" size={42} color={COLORS.blue} /></View>}
          <Text style={styles.detailName}>{detailProduct.name}</Text>
          <Text style={styles.detailSection}>{data.sections.find((item) => item.id === detailProduct.sectionId)?.name ?? "بدون قسم"}</Text>
          <Text style={styles.stockBadge}>{detailProduct.quantity} قطعة متبقية</Text><Text style={styles.barcodeText}>باركود: {detailProduct.barcode}</Text>
          <Text style={styles.detailDescription}>{detailProduct.description || "لا يوجد وصف مضاف لهذا المنتج."}</Text>
          <Text style={styles.detailDate}>أضيف في {formatDate(detailProduct.createdAt)}</Text>
          <View style={styles.actionRow}><Pressable style={styles.primaryButton} onPress={() => openEditProduct(detailProduct)}><Ionicons name="create-outline" size={18} color={COLORS.white} /><Text style={styles.primaryButtonText}>تعديل</Text></Pressable><Pressable style={styles.ghostButton} onPress={() => deleteProduct(detailProduct)}><Ionicons name="trash-outline" size={18} color={COLORS.red} /><Text style={styles.dangerText}>حذف</Text></Pressable></View>
        </> : null}
      </ModalShell>
    </ScreenContainer>
  );
}

function StatCard({ number, label, icon }: { number: number; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.statCard}><Ionicons name={icon} size={20} color={COLORS.blue} /><Text style={styles.statNumber}>{number}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function ProductCard({ product, sectionName, onPress, onEdit }: { product: Product; sectionName: string; onPress: () => void; onEdit: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.82 }]}>
    <View style={styles.productThumbFrame}>{product.imageUri ? <Image source={{ uri: product.imageUri }} resizeMode="contain" style={styles.productThumb} /> : <ProductIllustration />}</View>
    <View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productSection}>{sectionName} · {product.quantity} قطعة متبقية</Text><Text style={styles.productDescription} numberOfLines={2}>{product.description || "بدون وصف"}</Text></View>
    <Pressable onPress={(event) => { event.stopPropagation(); onEdit(); }} style={styles.editButton}><Ionicons name="create-outline" size={18} color={COLORS.blue} /></Pressable>
  </Pressable>;
}

function ProductIllustration() {
  return <Svg width="68%" height="68%" viewBox="0 0 100 100">
    <Polygon points="50,8 88,28 50,48 12,28" fill="#DCEBFA" />
    <Polygon points="12,28 50,48 50,90 12,70" fill="#80B2E3" />
    <Polygon points="50,48 88,28 88,70 50,90" fill="#4D8BCB" />
    <Polygon points="43,12 57,19 50,23 36,16" fill="#FFFFFF" />
  </Svg>;
}

function EmptyState({ icon, title, text, actionLabel, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={COLORS.blue} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text>{actionLabel && onAction ? <Pressable style={styles.primaryButton} onPress={onAction}><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 18, paddingBottom: 44, gap: 18, backgroundColor: COLORS.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: COLORS.bg },
  muted: { color: COLORS.muted, fontSize: 14, textAlign: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  brandCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { color: COLORS.blue, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  title: { color: COLORS.navy, fontSize: 25, fontWeight: "800", textAlign: "right" },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 5 },
  brandIcon: { width: 70, height: 70, borderRadius: 20, backgroundColor: COLORS.blueLight },
  autoBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ECF8F3", borderColor: "#CDEBDD", borderWidth: 1, borderRadius: 18, padding: 13 },
  autoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  autoTitle: { color: COLORS.navy, fontWeight: "800", fontSize: 13, textAlign: "right" },
  autoText: { color: COLORS.green, fontSize: 11, textAlign: "right", marginTop: 2 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
  searchBox: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: COLORS.navy, fontSize: 14, paddingVertical: 10 },
  statsRow: { flexDirection: "row", gap: 9 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 17, padding: 13, borderWidth: 1, borderColor: COLORS.border, alignItems: "flex-end", gap: 4 },
  statNumber: { color: COLORS.navy, fontSize: 25, fontWeight: "800" },
  statLabel: { color: COLORS.muted, fontSize: 12 },
  sectionBlock: { gap: 13 },
  blockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockTitle: { color: COLORS.navy, fontSize: 19, fontWeight: "800", textAlign: "right" },
  countText: { color: COLORS.muted, fontSize: 12 },
  addSmallButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.blue, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  addSmallText: { color: COLORS.white, fontWeight: "700", fontSize: 12 },
  sectionCard: { backgroundColor: COLORS.white, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  sectionAccent: { height: 4, backgroundColor: COLORS.blue },
  sectionCardContent: { flexDirection: "row", alignItems: "center", padding: 15, gap: 12 },
  sectionArrow: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center" },
  sectionCardText: { flex: 1, alignItems: "flex-end" },
  editSectionButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center" },
  sectionName: { color: COLORS.navy, fontSize: 17, fontWeight: "800" },
  sectionMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  sectionIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center" },
  productCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 19, padding: 11, gap: 11, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  productThumbFrame: { width: 86, height: 86, borderRadius: 17, backgroundColor: "#F0F5FB", borderWidth: 1, borderColor: "#E0EAF5", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  productThumb: { width: "100%", height: "100%", padding: 5 },
  productCopy: { flex: 1, alignItems: "flex-end" },
  productName: { color: COLORS.navy, fontSize: 15, fontWeight: "800" },
  productSection: { color: COLORS.blue, fontSize: 11, fontWeight: "700", marginTop: 3 },
  productDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 17, textAlign: "right", marginTop: 4 },
  editButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 3, padding: 5 },
  backText: { color: COLORS.blue, fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 9, alignItems: "center" },
  primaryButton: { minHeight: 46, flex: 1, backgroundColor: COLORS.blue, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 16 },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  ghostButton: { minHeight: 44, flex: 1, borderRadius: 13, borderWidth: 1, borderColor: "#F0C6C6", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 12 },
  dangerText: { color: COLORS.red, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  emptyState: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 24, backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: COLORS.navy, fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,37,63,0.35)" },
  modalCard: { maxHeight: "92%", backgroundColor: COLORS.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 13 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 },
  modalTitle: { color: COLORS.navy, fontSize: 18, fontWeight: "800", textAlign: "right" },
  iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  modalContent: { padding: 18, gap: 15 },
  modalHint: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  fieldWrap: { gap: 7 },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { color: COLORS.navy, fontSize: 13, fontWeight: "800", textAlign: "right" },
  input: { backgroundColor: COLORS.white, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, color: COLORS.navy, fontSize: 14 },
  multiline: { minHeight: 92, paddingTop: 13, textAlignVertical: "top" },
  imagePicker: { minHeight: 150, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  imagePlaceholder: { alignItems: "center", gap: 8 },
  imagePickerText: { color: COLORS.blue, fontSize: 13, fontWeight: "700" },
  previewImage: { width: "100%", height: 190, backgroundColor: COLORS.white },
  detailImage: { width: "100%", height: 220, borderRadius: 18, backgroundColor: COLORS.blueLight },
  detailImagePlaceholder: { height: 150, borderRadius: 18, backgroundColor: COLORS.blueLight, alignItems: "center", justifyContent: "center" },
  detailName: { color: COLORS.navy, fontSize: 23, fontWeight: "800", textAlign: "right" },
  detailSection: { color: COLORS.blue, fontSize: 13, fontWeight: "800", textAlign: "right" },
  barcodeText: { color: COLORS.muted, fontSize: 11, textAlign: "right" },
  stockBadge: { alignSelf: "flex-end", color: COLORS.green, backgroundColor: "#ECF8F3", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: "900" },
  detailDescription: { color: COLORS.muted, fontSize: 14, lineHeight: 22, textAlign: "right" },
  detailDate: { color: COLORS.muted, fontSize: 12, textAlign: "right" },
});
