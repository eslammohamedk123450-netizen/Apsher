import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";

const ACCENT = "#178A5A";

/** تبويبات منظومة «مزرعتي»: الرئيسية · الأرشيف · المحذوف · الباركود · الإعدادات. */
export default function MazraatyTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "#8B97A7",
        tabBarButton: HapticTab,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#FFFFFF",
          borderTopColor: "#DCE4EF",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf-outline" color={color} size={size ?? 23} />
          ),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: "الأرشيف",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="archive-outline" color={color} size={size ?? 23} />
          ),
        }}
      />
      <Tabs.Screen
        name="trash"
        options={{
          title: "المحذوف",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trash-outline" color={color} size={size ?? 23} />
          ),
        }}
      />
      <Tabs.Screen
        name="barcodes"
        options={{
          title: "الباركود",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barcode-outline" color={color} size={size ?? 23} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size ?? 23} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700" },
});
