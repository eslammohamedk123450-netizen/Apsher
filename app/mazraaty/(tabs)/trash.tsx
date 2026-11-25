import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/mazraaty/app-header";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import {
  RETENTION_OPTIONS,
  formatDateTime,
  useMazraaty,
  type MazraatyTrashEntry,
} from "@/lib/mazraaty-store";

export default function MazraatyTrashScreen() {
  const router = useRouter();
  const {
    data,
    ready,
    restoreTrash,
    purgeTrash,
    emptyTrash,
    setTrashRetention,
  } = useMazraaty();

  const entries = data.trash;

  const kindLabel = (entry: MazraatyTrashEntry) =>
    entry.kind === "section"
      ? "قسم"
      : entry.kind === "item"
        ? "عنصر"
        : "ملاحظة";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <AppHeader
          title="المحذوف"
          subtitle={`${entries.length} عنصر محذوف`}
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.groupTitle}>مدة الاحتفاظ بالمحذوفات</Text>
          <View style={styles.retentionRow}>
            {RETENTION_OPTIONS.map((option) => {
              const active = data.settings.trashRetention === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setTrashRetention(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.retentionHint}>
            يتم حذف العناصر القديمة تلقائيًا عند فتح التطبيق.
          </Text>

          {!ready ? null : entries.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="trash-outline" size={32} color={MZ.green} />
              </View>
              <Text style={styles.emptyTitle}>المحذوف فارغ</Text>
              <Text style={styles.emptyText}>
                أي حذف من التطبيق يصل هنا أولًا، لتستعيده أو تحذفه نهائيًا.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.trashHead}>
                <Text style={styles.groupTitle}>عناصر محذوفة</Text>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() =>
                    confirmAction(
                      "سيتم حذف كل عناصر المحذوفات نهائيًا. متأكد؟",
                      () => emptyTrash(),
                      "إفراغ",
                    )
                  }
                >
                  <Ionicons name="flame-outline" size={15} color={MZ.danger} />
                  <Text style={styles.emptyBtnText}>إفراغ الكل</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                {entries.map((entry) => (
                  <View key={entry.id} style={styles.row}>
                    {entry.imageUri ? (
                      <Image
                        source={{ uri: entry.imageUri }}
                        style={styles.rowImg}
                      />
                    ) : (
                      <View style={[styles.rowImg, styles.rowImgPlaceholder]}>
                        <Ionicons
                          name={
                            entry.kind === "note"
                              ? "chatbubble-outline"
                              : entry.kind === "item"
                                ? "cube-outline"
                                : "folder-open-outline"
                          }
                          size={20}
                          color={MZ.green}
                        />
                      </View>
                    )}
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {entry.title || kindLabel(entry)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {kindLabel(entry)} · {formatDateTime(entry.deletedAt)}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => restoreTrash(entry.id)}
                      hitSlop={6}
                      accessibilityLabel="استعادة"
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={18}
                        color={MZ.green}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() =>
                        confirmAction(
                          "سيتم حذف هذا العنصر نهائيًا. متأكد؟",
                          () => purgeTrash(entry.id),
                        )
                      }
                      hitSlop={6}
                      accessibilityLabel="حذف نهائي"
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color={MZ.danger}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  groupTitle: {
    color: MZ.navy,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  retentionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: MZ.white,
    borderWidth: 1,
    borderColor: MZ.border,
  },
  chipActive: { backgroundColor: MZ.green, borderColor: MZ.green },
  chipText: { color: MZ.navy, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: MZ.white },
  retentionHint: { color: MZ.muted, fontSize: 11, textAlign: "right" },

  trashHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: "#FDF1F1",
  },
  emptyBtnText: { color: MZ.danger, fontSize: 12, fontWeight: "800" },

  card: {
    backgroundColor: MZ.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MZ.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: MZ.border,
  },
  rowImg: { width: 46, height: 46, borderRadius: 12 },
  rowImgPlaceholder: {
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: {
    color: MZ.navy,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  rowMeta: { color: MZ.muted, fontSize: 11, textAlign: "right" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MZ.chip,
  },

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
});
