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
            {sectionProducts.length ? <View style={styles.gridContainer}>{sectionProducts.map((product) => <GridCard key={product.id} product={product} onPress={() => setDetailProduct(product)} />)}</View> : <EmptyState icon="cube-outline" title="القسم فارغ" text="أضف أول منتج ليظهر هنا." />}
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


function GridCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.gridCard}>
    <View style={styles.gridImage}>{product.imageUri ? <Image source={{ uri: product.imageUri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={24} color={COLORS.blue} /></View>}</View>
    <Text style={styles.gridName} numberOfLines={1}>{product.name}</Text>
    <Text style={styles.gridMeta}>{product.quantity} قطعة</Text>
  </Pressable>;
}

function ProductCard(props) { return null; }
