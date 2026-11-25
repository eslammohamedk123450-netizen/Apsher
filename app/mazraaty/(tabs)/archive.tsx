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
import { MZ } from "@/components/mazraaty/theme";
import { ScreenContainer } from "@/components/screen-container";
import { formatDateTime, useMazraaty } from "@/lib/mazraaty-store";

export default function MazraatyArchiveScreen() {
  const router = useRouter();
  const { data, ready, archiveSection, archiveItem, archiveNote } =
    useMazraaty();

  const sections = data.sections.filter((s) => s.archivedAt);
  const items = data.items.filter((i) => i.archivedAt);
  const notes = data.notes.filter((n) => n.archivedAt);
  const total = sections.length + items.length + notes.length;

  const sectionName = (sectionId: string) =>
    data.sections.find((s) => s.id === sectionId)?.name ?? "قسم";
  const itemName = (itemId: string) =>
    data.items.find((i) => i.id === itemId)?.name ?? "عنصر";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <AppHeader
          title="الأرشيف"
          subtitle={`${total} عنصر مؤرشف`}
          onLauncher={() => router.replace("/")}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {!ready ? null : total === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="archive-outline" size={32} color={MZ.green} />
              </View>
              <Text style={styles.emptyTitle}>الأرشيف فارغ</Text>
              <Text style={styles.emptyText}>
                أي قسم أو عنصر أو ملاحظة تؤرشفها ستظهر هنا، ويمكنك استعادتها في
                أي وقت.
              </Text>
            </View>
          ) : (
            <>
              {sections.length ? (
                <Group title="أقسام مؤرشفة">
                  {sections.map((section) => (
                    <Row
                      key={section.id}
                      kind="قسم"
                      title={section.name}
                      meta={formatDateTime(section.archivedAt!)}
                      imageUri={section.imageUri}
                      onRestore={() => archiveSection(section.id, false)}
                    />
                  ))}
                </Group>
              ) : null}

              {items.length ? (
                <Group title="عناصر مؤرشفة">
                  {items.map((item) => (
                    <Row
                      key={item.id}
                      kind="عنصر"
                      title={item.name}
                      meta={sectionName(item.sectionId)}
                      imageUri={item.imageUri}
                      onRestore={() => archiveItem(item.id, false)}
                    />
                  ))}
                </Group>
              ) : null}

              {notes.length ? (
                <Group title="ملاحظات مؤرشفة">
                  {notes.map((note) => (
                    <Row
                      key={note.id}
                      kind={
                        note.kind === "text"
                          ? "ملاحظة"
                          : note.kind === "image"
                            ? "صورة"
                            : "تسجيل"
                      }
                      title={
                        note.kind === "text"
                          ? note.text ?? "ملاحظة"
                          : note.kind === "image"
                            ? "صورة"
                            : "تسجيل صوتي"
                      }
                      meta={itemName(note.itemId)}
                      imageUri={note.imageUri}
                      onRestore={() => archiveNote(note.id, false)}
                    />
                  ))}
                </Group>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function Row({
  kind,
  title,
  meta,
  imageUri,
  onRestore,
}: {
  kind: string;
  title: string;
  meta: string;
  imageUri?: string | null;
  onRestore: () => void;
}) {
  return (
    <View style={styles.row}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.rowImg} />
      ) : (
        <View style={[styles.rowImg, styles.rowImgPlaceholder]}>
          <Ionicons name="cube-outline" size={20} color={MZ.green} />
        </View>
      )}
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowMeta}>
          {kind} · {meta}
        </Text>
      </View>
      <Pressable style={styles.restoreBtn} onPress={onRestore} hitSlop={6}>
        <Ionicons name="arrow-undo-outline" size={17} color={MZ.green} />
        <Text style={styles.restoreText}>استعادة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  group: { gap: 8 },
  groupTitle: {
    color: MZ.navy,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  groupCard: {
    backgroundColor: MZ.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MZ.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
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
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: MZ.greenSoft,
  },
  restoreText: { color: MZ.green, fontSize: 12, fontWeight: "800" },

  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
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
