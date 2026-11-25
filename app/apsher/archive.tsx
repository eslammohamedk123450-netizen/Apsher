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

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/local-store";

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

export default function ApsherArchiveScreen() {
  const router = useRouter();
  const {
    data,
    ready,
    archiveSection,
    archiveProduct,
    archiveBox,
    removeSection,
    removeProduct,
    removeBox,
  } = useApp();

  const sections = data.sections.filter((section) => section.archivedAt);
  const products = data.products.filter((product) => product.archivedAt);
  const boxes = data.boxes.filter((box) => box.archivedAt);
  const total = sections.length + products.length + boxes.length;

  const sectionName = (sectionId: string) =>
    data.sections.find((section) => section.id === sectionId)?.name ?? "قسم";

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
            <Text style={styles.title}>الأرشيف</Text>
            <Text style={styles.subtitle}>{total} عنصر مؤرشف</Text>
          </View>
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
            {total === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="archive-outline" size={32} color={C.blue} />
                </View>
                <Text style={styles.emptyTitle}>لا يوجد شيء في الأرشيف</Text>
                <Text style={styles.emptyText}>
                  عند أرشفة قسم أو منتج أو صندوق سيظهر هنا، ويمكنك استعادته في أي
                  وقت.
                </Text>
              </View>
            ) : null}

            {sections.length ? (
              <>
                <Text style={styles.groupTitle}>أقسام مؤرشفة</Text>
                {sections.map((section) => (
                  <View key={section.id} style={styles.card}>
                    {section.imageUri ? (
                      <Image
                        source={{ uri: section.imageUri }}
                        style={styles.thumb}
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons
                          name="folder-open-outline"
                          size={24}
                          color={C.blue}
                        />
                      </View>
                    )}
                    <View style={styles.copy}>
                      <Text style={styles.name}>{section.name}</Text>
                      <Text style={styles.meta}>قسم</Text>
                    </View>
                    <Pressable
                      style={styles.restoreBtn}
                      onPress={() => archiveSection(section.id, false)}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={17}
                        color={C.green}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => removeSection(section.id)}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.red} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            {products.length ? (
              <>
                <Text style={styles.groupTitle}>منتجات مؤرشفة</Text>
                {products.map((product) => (
                  <View key={product.id} style={styles.card}>
                    {product.imageUri ? (
                      <Image
                        source={{ uri: product.imageUri }}
                        style={styles.thumb}
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons name="cube-outline" size={24} color={C.blue} />
                      </View>
                    )}
                    <View style={styles.copy}>
                      <Text style={styles.name}>{product.name}</Text>
                      <Text style={styles.meta}>
                        {sectionName(product.sectionId)} · {product.quantity} قطعة
                      </Text>
                    </View>
                    <Pressable
                      style={styles.restoreBtn}
                      onPress={() => archiveProduct(product.id, false)}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={17}
                        color={C.green}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => removeProduct(product.id)}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.red} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            {boxes.length ? (
              <>
                <Text style={styles.groupTitle}>صناديق مؤرشفة</Text>
                {boxes.map((box) => (
                  <View key={box.id} style={styles.card}>
                    {box.imageUri ? (
                      <Image
                        source={{ uri: box.imageUri }}
                        style={styles.thumb}
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons
                          name="file-tray-full-outline"
                          size={24}
                          color={C.blue}
                        />
                      </View>
                    )}
                    <View style={styles.copy}>
                      <Text style={styles.name}>
                        {box.name || "صندوق بدون اسم"}
                      </Text>
                      <Text style={styles.meta}>{box.items.length} عنصر</Text>
                    </View>
                    <Pressable
                      style={styles.restoreBtn}
                      onPress={() => archiveBox(box.id, false)}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={17}
                        color={C.green}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => removeBox(box.id)}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.red} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  groupTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 6,
  },
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
  meta: { color: C.muted, fontSize: 11, marginTop: 3 },
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
  empty: { alignItems: "center", gap: 10, paddingVertical: 70 },
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
