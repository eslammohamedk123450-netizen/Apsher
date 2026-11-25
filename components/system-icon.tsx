import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

export type SystemIconProps = {
  /** اسم المنظومة الذي يظهر تحت الأيقونة */
  title: string;
  /** الأيقونة المربعة للمنظومة */
  icon: ImageSourcePropType;
  /** ضلع الأيقونة المربعة */
  size?: number;
  /** شارة صغيرة مثل «قريباً» */
  badge?: string;
  onPress: () => void;
};

/** أيقونة منظومة مربعة مع اسمها تحتها، بأسلوب بطاقات التطبيقات الاحترافية. */
export function SystemIcon({
  title,
  icon,
  size = 122,
  badge,
  onPress,
}: SystemIconProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      hitSlop={12}
      accessibilityLabel={title}
    >
      <View style={styles.iconLayer}>
        <View style={styles.iconRing} />
        <Image
          source={icon}
          style={[
            styles.iconImage,
            { width: size, height: size, borderRadius: Math.round(size * 0.24) },
          ]}
        />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: 148 },
  pressed: { opacity: 0.88 },
  iconLayer: {
    alignItems: "center",
    justifyContent: "center",
    width: 146,
    height: 146,
    marginBottom: 10,
  },
  iconRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE4EF",
    shadowColor: "#10253F",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconImage: { backgroundColor: "#F1F5FA" },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#178A5A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  title: {
    color: "#10253F",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    width: 148,
  },
});
