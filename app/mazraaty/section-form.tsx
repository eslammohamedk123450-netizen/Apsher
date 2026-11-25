import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/mazraaty/app-header";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import { normalizeBarcode } from "@/lib/barcode-lookup";
import {
  makeMazraatyBarcode,
  useMazraaty,
  type MazraatySection,
} from "@/lib/mazraaty-store";

export default function SectionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, ready } = useMazraaty();
  const editing = id
    ? data.sections.find((s) => s.id === id) ?? null
    : null;

  if (!ready) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MZ.green} />
        </View>
      </ScreenContainer>
    );
  }

  return <SectionForm key={editing?.id ?? "new"} editing={editing} />;
}

function SectionForm({ editing }: { editing: MazraatySection | null }) {
  const router = useRouter();
  const { data, addSection, updateSection, removeSection, chooseImage } =
    useMazraaty();

  const [name, setName] = useState(editing?.name ?? "");
  const [imageUri, setImageUri] = useState<string | null>(
    editing?.imageUri ?? null,
  );
  const [barcode, setBarcode] = useState(editing?.barcode ?? "");
  const [picking, setPicking] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/mazraaty");
  };

  const pickImage = async () => {
    try {
      setPicking(true);
      const uri = await chooseImage();
      if (uri) setImageUri(uri);
    } catch (error) {
      if (typeof window !== "undefined")
        window.alert(
          error instanceof Error ? error.message : "تعذر اختيار الصورة",
        );
    } finally {
      setPicking(false);
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const commit = () => {
      if (editing) {
        updateSection(editing.id, { name: trimmed, imageUri, barcode });
      } else {
        addSection({ name: trimmed, imageUri, barcode });
      }
      goBack();
    };

    // تنبيه إن كان الباركود مستخدمًا في قسم أو عنصر آخر.
    const code = barcode.trim();
    if (code) {
      const scanned = normalizeBarcode(code);
      const clashSection = data.sections.find(
        (section) =>
          section.id !== editing?.id &&
          section.barcode &&
          normalizeBarcode(section.barcode) === scanned,
      );
      const clashItem = data.items.find(
        (item) => normalizeBarcode(item.barcode) === scanned,
      );
      if (clashSection || clashItem) {
        confirmAction(
          `هذا الباركود مستخدم بالفعل في ${
            clashSection ? `قسم «${clashSection.name}»` : `عنصر «${clashItem?.name}»`
          }. هل تريد حفظ القسم على أي حال؟`,
          commit,
          "حفظ",
        );
        return;
      }
    }
    commit();
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.root}>
        <AppHeader
          title={editing ? "تعديل القسم" : "قسم جديد"}
          onBack={goBack}
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            {picking ? (
              <ActivityIndicator color={MZ.green} />
            ) : imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePickerImg}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="image-outline" size={30} color={MZ.green} />
                <Text style={styles.imagePickerText}>
                  إضافة صورة للقسم (اختياري)
                </Text>
                <Text style={styles.imagePickerHint}>
                  تظهر كمربع واضح في الرئيسية
                </Text>
              </>
            )}
          </Pressable>
          {imageUri ? (
            <Pressable
              style={styles.removeImage}
              onPress={() => setImageUri(null)}
            >
              <Ionicons name="close-circle" size={16} color={MZ.danger} />
              <Text style={styles.removeImageText}>إزالة الصورة</Text>
            </Pressable>
          ) : null}

          <Text style={styles.label}>اسم القسم</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="مثال: الحيوانات"
            placeholderTextColor="#9AA7B8"
            style={styles.input}
            autoFocus={!editing}
          />

          <Text style={styles.label}>باركود القسم (اختياري)</Text>
          <View style={styles.barcodeRow}>
            <TextInput
              value={barcode}
              onChangeText={setBarcode}
              placeholder="اتركه فارغًا أو أدخل باركود"
              placeholderTextColor="#9AA7B8"
              style={[styles.input, styles.barcodeInput]}
              autoCapitalize="characters"
            />
            {!barcode.trim() ? (
              <Pressable
                style={styles.genBtn}
                onPress={() => setBarcode(makeMazraatyBarcode())}
              >
                <Ionicons name="refresh" size={17} color={MZ.green} />
                <Text style={styles.genText}>توليد</Text>
              </Pressable>
            ) : null}
          </View>
          {barcode.trim() ? (
            <Text style={styles.barcodeHint}>
              الباركود ثابت ولا يتغيّر تلقائيًا؛ اطبعه مرة واحدة والصقه على القسم.
            </Text>
          ) : null}
          {barcode ? (
            <Pressable
              style={styles.clearBarcode}
              onPress={() => setBarcode("")}
            >
              <Ionicons name="close-circle" size={14} color={MZ.muted} />
              <Text style={styles.clearBarcodeText}>إزالة الباركود</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              !name.trim() && styles.primaryBtnDisabled,
              pressed && { opacity: 0.88 },
            ]}
            onPress={save}
            disabled={!name.trim()}
          >
            <Text style={styles.primaryBtnText}>
              {editing ? "حفظ التعديل" : "إنشاء القسم"}
            </Text>
          </Pressable>

          {editing ? (
            <Pressable
              style={styles.dangerBtn}
              onPress={() =>
                confirmAction(
                  `سيتم نقل قسم «${editing.name}» وكل عناصره وملاحظاته إلى المحذوفات. متأكد؟`,
                  () => {
                    removeSection(editing.id);
                    router.replace("/mazraaty");
                  },
                )
              }
            >
              <Ionicons name="trash-outline" size={18} color={MZ.danger} />
              <Text style={styles.dangerText}>حذف القسم</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },

  imagePicker: {
    aspectRatio: 1,
    maxHeight: 220,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#B7C7DA",
    backgroundColor: "#F7FAFD",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
    maxWidth: 220,
  },
  imagePickerImg: { width: "100%", height: "100%" },
  imagePickerText: { color: MZ.green, fontSize: 13, fontWeight: "800" },
  imagePickerHint: { color: MZ.muted, fontSize: 11 },
  removeImage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  removeImageText: { color: MZ.danger, fontSize: 12, fontWeight: "700" },

  label: {
    color: MZ.navy,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C8D7E8",
    backgroundColor: MZ.white,
    color: MZ.navy,
    fontSize: 15,
    paddingHorizontal: 14,
    textAlign: "right",
  },
  barcodeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  barcodeInput: { flex: 1 },
  barcodeHint: {
    color: MZ.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: -6,
  },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: MZ.greenSoft,
  },
  genText: { color: MZ.green, fontSize: 13, fontWeight: "800" },
  clearBarcode: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  clearBarcodeText: { color: MZ.muted, fontSize: 12, fontWeight: "700" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: MZ.green,
    minHeight: 52,
    borderRadius: 16,
  },
  primaryBtnDisabled: { backgroundColor: "#9DB9AB" },
  primaryBtnText: { color: MZ.white, fontSize: 15, fontWeight: "900" },

  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0C4C4",
    backgroundColor: "#FDF1F1",
  },
  dangerText: { color: MZ.danger, fontSize: 14, fontWeight: "800" },
});
