import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/mazraaty/app-header";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { KeyboardAwareScroll } from "@/components/keyboard-aware-scroll";
import { ScreenContainer } from "@/components/screen-container";
import { useMazraaty, type MazraatyItem } from "@/lib/mazraaty-store";

export default function ItemFormScreen() {
  const { id, sectionId } = useLocalSearchParams<{
    id?: string;
    sectionId?: string;
  }>();
  const { data, ready } = useMazraaty();
  const editing = id ? data.items.find((i) => i.id === id) ?? null : null;
  const targetSectionId = editing?.sectionId ?? sectionId ?? "";
  const section = data.sections.find((s) => s.id === targetSectionId);

  if (!ready) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MZ.green} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ItemForm
      key={editing?.id ?? "new"}
      editing={editing}
      sectionId={targetSectionId}
      sectionName={section?.name}
    />
  );
}

function ItemForm({
  editing,
  sectionId,
  sectionName,
}: {
  editing: MazraatyItem | null;
  sectionId: string;
  sectionName?: string;
}) {
  const router = useRouter();
  const { addItem, updateItem, removeItem, chooseImage } = useMazraaty();

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [imageUri, setImageUri] = useState<string | null>(
    editing?.imageUri ?? null,
  );
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
    if (!trimmed || !sectionId) return;
    if (editing) {
      updateItem(editing.id, { name: trimmed, description, imageUri });
    } else {
      addItem({ sectionId, name: trimmed, description, imageUri });
    }
    goBack();
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.root}>
        <AppHeader
          title={editing ? "تعديل العنصر" : "عنصر جديد"}
          subtitle={sectionName}
          onBack={goBack}
          onLauncher={() => router.replace("/")}
        />

        <KeyboardAwareScroll contentContainerStyle={styles.content}>
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
                  إضافة صورة للعنصر (اختياري)
                </Text>
                <Text style={styles.imagePickerHint}>
                  تظهر كمربع واضح لعنصرك
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

          <Text style={styles.label}>اسم العنصر</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="مثال: أرنب"
            placeholderTextColor="#9AA7B8"
            style={styles.input}
            autoFocus={!editing}
          />

          <Text style={styles.label}>وصف (اختياري)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="اكتب وصفًا قصيرًا..."
            placeholderTextColor="#9AA7B8"
            style={[styles.input, styles.textArea]}
            multiline
          />

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
              {editing ? "حفظ التعديل" : "إضافة العنصر"}
            </Text>
          </Pressable>

          {editing ? (
            <Pressable
              style={styles.dangerBtn}
              onPress={() =>
                confirmAction(
                  `سيتم نقل عنصر «${editing.name}» وكل ملاحظاته إلى المحذوفات. متأكد؟`,
                  () => {
                    removeItem(editing.id);
                    router.replace("/mazraaty");
                  },
                )
              }
            >
              <Ionicons name="trash-outline" size={18} color={MZ.danger} />
              <Text style={styles.dangerText}>حذف العنصر</Text>
            </Pressable>
          ) : null}
        </KeyboardAwareScroll>
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
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },

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
