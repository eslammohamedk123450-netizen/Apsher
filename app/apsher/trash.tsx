import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { confirmAction } from "@/components/mazraaty/confirm";
import { ScreenContainer } from "@/components/screen-container";
import {
  APSHER_RETENTION_OPTIONS,
  formatDate,
  useApp,
  type ApsherTrashEntry,
} from "@/lib/local-store";

const C = {
  navy: "#10253F",
  blue: "#2F78C9",
  blueLight: "#EAF3FC",
  green: "#16846E",
  red: "#CF4B4B",
  bg: "#F6F8FB",
  white: "#FFFFFF",
  muted: "#68768A",
  border: "#DCE4EF",
};

export default function ApsherTrashScreen() {
  const router = useRouter();
  const {
    data,
    ready,
    restoreTrash,
    purgeTrash,
    emptyTrash,
    setTrashRetention,
  } = useApp();

  const entries = data.trash;

  const kindLabel = (entry: ApsherTrashEntry) =>
    entry.kind === "section"
      ? "قسم"
      : entry.kind === "product"
        ? "منتج"
        : "صندوق";

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={22} color={C.navy} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>المحذوفات</Text>
            <Text style={styles.subtitle}>{entries.length} عنصر محذوف</Text>
          </View>
          {entries.length ? (
            <Pressable
              style={styles.emptyBtn}
              onPress={() =>
                confirmAction(
                  "سيتم حذف كل المحذوفات نهائيًا ولا يمكن التراجع. متأكد؟",
                  () => emptyTrash(),
                  "إفراغ",
                )
              }
            >
              <Ionicons name="trash-outline" size={16} color={C.red} />
              <Text style={styles.emptyBtnText}>إفراغ</Text>
            </Pressable>
          ) : null}
        </View>

        {!ready ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.retentionCard}>
              <Text style={styles.rowTitle}>مدة الاحتفاظ</Text>
              <Text style={styles.rowDescription}>
                تُحذف العناصر القديمة تلقائيًا عند فتح التطبيق.
              </Text>
              <View style={styles.retentionRow}>
                {APSHER_RETENTION_OPTIONS.map((option) => {
                  const active =
                    data.settings.trashRetention === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setTrashRetention(option.value)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {entries.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="trash-outline" size={32} color={C.blue} />
                </View>
                <Text style={styles.emptyTitle}>سلة المحذوفات فارغة</Text>
                <Text style={styles.emptyText}>
                  كل ما تحذفه يبقى هنا حتى تحدّد مدة الاحتفاظ أو تفرغ السلة
                  يدويًا.
                </Text>
              </View>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.card}>
                  {entry.imageUri ? (
                    <Image
                      source={{ uri: entry.imageUri }}
                      style={styles.thumb}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons
                        name={
                          entry.kind === "box"
                            ? "file-tray-full-outline"
                            : entry.kind === "product"
                              ? "cube-outline"
                              : "folder-open-outline"
                        }
                        size={24}
                        color={C.blue}
                      />
                    </View>
                  )}
                  <View style={styles.copy}>
                    <Text style={styles.name} numberOfLines={1}>
                      {entry.title || kindLabel(entry)}
                    </Text>
                    <Text style={styles.meta}>
                      {kindLabel(entry)} · حُذف {formatDate(entry.deletedAt)}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.restoreBtn}
                    onPress={() => restoreTrash(entry.id)}
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={17}
                      color={C.green}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() =>
                      confirmAction(
                        "سيتم الحذف نهائيًا ولا يمكن التراجع. متأكد؟",
                        () => purgeTrash(entry.id),
                        "حذف",
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={17} color={C.red} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  title: { color: C.navy, fontSize: 19, fontWeight: "900", textAlign: "right" },
  subtitle: { color: C.muted, fontSize: 12, textAlign: "right", marginTop: 2 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: "#FFF1F1",
  },
  emptyBtnText: { color: C.red, fontSize: 12, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  retentionCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 3,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  rowDescription: {
    color: C.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 3,
  },
  retentionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { color: C.navy, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: C.white },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 10,
  },
  thumb: { width: 54, height: 54, borderRadius: 13, backgroundColor: C.blueLight },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignItems: "flex-end" },
  name: { color: C.navy, fontSize: 15, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 11, marginTop: 3, textAlign: "right" },
  restoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ECF8F3",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: C.navy, fontSize: 18, fontWeight: "900" },
  emptyText: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 330,
  },
});
