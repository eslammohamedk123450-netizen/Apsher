import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MZ } from "./theme";

export type ActionSheetAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

/**
 * قائمة خيارات (تعديل / أرشفة / حذف) تظهر عند الضغط المطوّل.
 * طبقة داخل الشاشة نفسها، فتختفي تمامًا عند الإغلاق أو الانتقال.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
  accentColor = MZ.green,
  accentSoft = MZ.greenSoft,
  dangerColor = MZ.danger,
}: {
  visible: boolean;
  title?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
  /** لون أيقونات الخيارات العادية (أخضر لمزرعتي، أزرق لأبشر). */
  accentColor?: string;
  /** خلفية أيقونات الخيارات العادية. */
  accentSoft?: string;
  /** لون خيارات الخطر (حذف). */
  dangerColor?: string;
}) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}

        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: accentSoft },
                action.danger && styles.iconDanger,
              ]}
            >
              <Ionicons
                name={action.icon}
                size={19}
                color={action.danger ? dangerColor : accentColor}
              />
            </View>
            <Text
              style={[
                styles.label,
                action.danger && { color: dangerColor },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
          onPress={onClose}
        >
          <Text style={styles.cancelText}>إلغاء</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 70,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(16,37,63,0.35)",
  },
  sheet: {
    backgroundColor: MZ.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 22,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  title: {
    color: MZ.navy,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MZ.border,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 13,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDanger: { backgroundColor: "#FDF1F1" },
  label: {
    flex: 1,
    color: MZ.navy,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  cancel: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: MZ.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: MZ.navy, fontSize: 15, fontWeight: "900" },
});
