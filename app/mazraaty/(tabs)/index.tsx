import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ActionSheet } from "@/components/mazraaty/action-sheet";
import { AppHeader } from "@/components/mazraaty/app-header";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import { useMazraaty, type MazraatySection } from "@/lib/mazraaty-store";

export default function MazraatyHomeScreen() {
  const router = useRouter();
  const { data, ready, archiveSection, removeSection } = useMazraaty();
  const [menuFor, setMenuFor] = useState<MazraatySection | null>(null);

  const sections = data.sections.filter((section) => !section.archivedAt);
  const activeItems = data.items.filter((item) => !item.archivedAt);

  const countItems = (sectionId: string) =>
    activeItems.filter((item) => item.sectionId === sectionId).length;

  const openSection = (section: MazraatySection) =>
    router.push({
      pathname: "/mazraaty/section/[id]",
      params: { id: section.id },
    });

  const createSection = () =>
    router.push({ pathname: "/mazraaty/section-form", params: {} });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <AppHeader
          title="مزرعتي"
          subtitle="أقسامك وعناصرك وملاحظاتك"
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stats}>
            <StatChip icon="folder-open-outline" value={sections.length} label="قسم" />
            <StatChip icon="cube-outline" value={activeItems.length} label="عنصر" />
          </View>

          {!ready ? null : sections.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="leaf-outline" size={34} color={MZ.green} />
              </View>
              <Text style={styles.emptyTitle}>ابدأ بأول قسم</Text>
              <Text style={styles.emptyText}>
                القسم هو مجموعة عناصر — مثل «الحيوانات» أو «المزروعات». اجعله
                بصورة واضحة ليظهر كأيقونة مميزة.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {sections.map((section, index) => (
                <Pressable
                  key={section.id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && { opacity: 0.86 },
                  ]}
                  onPress={() => openSection(section)}
                  onLongPress={() => setMenuFor(section)}
                  delayLongPress={320}
                >
                  <View style={styles.thumbWrap}>
                    {section.imageUri ? (
                      <Image
                        source={{ uri: section.imageUri }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons
                          name="folder-open-outline"
                          size={38}
                          color={MZ.green}
                        />
                      </View>
                    )}
                    <View style={styles.numberBadge}>
                      <Text style={styles.numberText}>{index + 1}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {section.name}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {countItems(section.id)} عنصر
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
            onPress={createSection}
          >
            <Ionicons name="add" size={22} color={MZ.white} />
            <Text style={styles.primaryBtnText}>إنشاء قسم</Text>
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
                  label: "تعديل القسم",
                  onPress: () =>
                    router.push({
                      pathname: "/mazraaty/section-form",
                      params: { id: menuFor.id },
                    }),
                },
                {
                  icon: "archive-outline",
                  label: "أرشفة القسم",
                  onPress: () =>
                    confirmAction(
                      `سيتم نقل قسم «${menuFor.name}» إلى الأرشيف. متأكد؟`,
                      () => {
                        archiveSection(menuFor.id, true);
                      },
                      "أرشفة",
                    ),
                },
                {
                  icon: "trash-outline",
                  label: "حذف القسم",
                  danger: true,
                  onPress: () =>
                    confirmAction(
                      `سيتم نقل قسم «${menuFor.name}» وكل عناصره وملاحظاته إلى المحذوفات. متأكد؟`,
                      () => {
                        removeSection(menuFor.id);
                      },
                    ),
                },
              ]
            : []
        }
      />
    </ScreenContainer>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={18} color={MZ.green} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  list: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  stats: { flexDirection: "row", gap: 10 },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 14,
    paddingVertical: 11,
  },
  statValue: { color: MZ.navy, fontSize: 16, fontWeight: "900" },
  statLabel: { color: MZ.muted, fontSize: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: "46%",
    maxWidth: "49%",
    backgroundColor: MZ.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 10,
    gap: 6,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, borderRadius: 14 },
  thumbPlaceholder: {
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { color: MZ.white, fontSize: 13, fontWeight: "900" },
  cardName: {
    color: MZ.navy,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  cardMeta: { color: MZ.muted, fontSize: 11, textAlign: "right" },

  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: MZ.navy, fontSize: 19, fontWeight: "900" },
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
