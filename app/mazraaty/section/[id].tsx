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
  View,
} from "react-native";

import { ActionSheet } from "@/components/mazraaty/action-sheet";
import { AppHeader } from "@/components/mazraaty/app-header";
import { Barcode } from "@/components/barcode";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import { useMazraaty, type MazraatyItem } from "@/lib/mazraaty-store";

export default function MazraatySectionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, ready, archiveItem, removeItem } = useMazraaty();
  const [menuFor, setMenuFor] = useState<MazraatyItem | null>(null);

  const section = data.sections.find((s) => s.id === id);
  const items = data.items.filter((i) => i.sectionId === id && !i.archivedAt);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/mazraaty");
  };

  if (!ready) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MZ.green} />
        </View>
      </ScreenContainer>
    );
  }

  if (!section) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.root}>
          <AppHeader
            title="قسم غير موجود"
            onBack={goBack}
            onLauncher={() => router.replace("/")}
          />
          <View style={styles.center}>
            <Text style={styles.mutedText}>هذا القسم لم يعد موجودًا.</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const notesCount = (itemId: string) =>
    data.notes.filter((n) => n.itemId === itemId && !n.archivedAt).length;

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.root}>
        <AppHeader
          title={section.name}
          subtitle={`${items.length} عنصر`}
          onBack={goBack}
          onLauncher={() => router.replace("/")}
          right={
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/mazraaty/section-form",
                  params: { id: section.id },
                })
              }
              style={styles.headerIcon}
              hitSlop={6}
              accessibilityLabel="تعديل القسم"
            >
              <Ionicons name="create-outline" size={19} color={MZ.green} />
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* بطاقة القسم */}
          <View style={styles.banner}>
            {section.imageUri ? (
              <Image
                source={{ uri: section.imageUri }}
                style={styles.bannerImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.bannerImg, styles.bannerPlaceholder]}>
                <Ionicons
                  name="folder-open-outline"
                  size={44}
                  color={MZ.green}
                />
              </View>
            )}
            <View style={styles.bannerBody}>
              <Text style={styles.bannerName}>{section.name}</Text>
              <Text style={styles.bannerMeta}>
                {items.length} عنصر ·{" "}
                {data.notes.filter((n) => {
                  const ids = new Set(items.map((i) => i.id));
                  return ids.has(n.itemId) && !n.archivedAt;
                }).length}{" "}
                ملاحظة
              </Text>
              {section.barcode ? (
                <View style={styles.barcodeBox}>
                  <Barcode
                    value={section.barcode}
                    format="CODE128"
                    height={44}
                    maxWidth={260}
                  />
                  <Text style={styles.barcodeText}>{section.barcode}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={32} color={MZ.green} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد عناصر بعد</Text>
              <Text style={styles.emptyText}>
                أنشئ عنصرًا مثل «أرنب» أو «شجرة ليمون»، ثم افتحه لتكتب ملاحظاتك
                وصورك وتسجيلاتك الصوتية.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.itemCard,
                    pressed && { opacity: 0.86 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/mazraaty/item/[id]",
                      params: { id: item.id },
                    })
                  }
                  onLongPress={() => setMenuFor(item)}
                  delayLongPress={320}
                >
                  {item.imageUri ? (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.itemImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                      <Ionicons name="cube-outline" size={36} color={MZ.green} />
                    </View>
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {notesCount(item.id)} ملاحظة
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={() =>
              router.push({
                pathname: "/mazraaty/item-form",
                params: { sectionId: section.id },
              })
            }
          >
            <Ionicons name="add" size={22} color={MZ.white} />
            <Text style={styles.primaryBtnText}>إنشاء عنصر</Text>
          </Pressable>
        </View>
      </View>

      <ActionSheet
        visible={Boolean(menuFor)}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                {
                  icon: "create-outline",
                  label: "تعديل العنصر",
                  onPress: () =>
                    router.push({
                      pathname: "/mazraaty/item-form",
                      params: { id: menuFor.id },
                    }),
                },
                {
                  icon: "archive-outline",
                  label: "أرشفة العنصر",
                  onPress: () =>
                    confirmAction(
                      `سيتم نقل عنصر «${menuFor.name}» إلى الأرشيف. متأكد؟`,
                      () => archiveItem(menuFor.id, true),
                      "أرشفة",
                    ),
                },
                {
                  icon: "trash-outline",
                  label: "حذف العنصر",
                  danger: true,
                  onPress: () =>
                    confirmAction(
                      `سيتم نقل عنصر «${menuFor.name}» وكل ملاحظاته إلى المحذوفات. متأكد؟`,
                      () => removeItem(menuFor.id),
                    ),
                },
              ]
            : []
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mutedText: { color: MZ.muted, fontSize: 14 },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  banner: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    backgroundColor: MZ.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 10,
  },
  bannerImg: { width: 96, height: 96, borderRadius: 14 },
  bannerPlaceholder: {
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerBody: { flex: 1, gap: 4, justifyContent: "center" },
  bannerName: {
    color: MZ.navy,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  bannerMeta: { color: MZ.muted, fontSize: 12, textAlign: "right" },
  barcodeBox: { alignItems: "center", marginTop: 6, gap: 3 },
  barcodeText: { color: MZ.muted, fontSize: 10, letterSpacing: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  itemCard: {
    flexGrow: 1,
    flexBasis: "46%",
    maxWidth: "49%",
    backgroundColor: MZ.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 9,
    gap: 5,
  },
  itemImg: { width: "100%", aspectRatio: 1, borderRadius: 13 },
  itemImgPlaceholder: {
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    color: MZ.navy,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  itemMeta: { color: MZ.muted, fontSize: 11, textAlign: "right" },

  empty: { alignItems: "center", gap: 10, paddingVertical: 50 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: MZ.navy, fontSize: 18, fontWeight: "900" },
  emptyText: {
    color: MZ.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 330,
  },

  footer: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: MZ.white,
    borderTopWidth: 1,
    borderTopColor: MZ.border,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: MZ.green,
    minHeight: 52,
    borderRadius: 16,
  },
  primaryBtnText: { color: MZ.white, fontSize: 15, fontWeight: "900" },
});
