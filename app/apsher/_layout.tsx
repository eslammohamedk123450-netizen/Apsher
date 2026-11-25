import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppLock } from "@/components/app-lock";
import { HapticTab } from "@/components/haptic-tab";
import { AppProvider } from "@/lib/local-store";

export default function ApsherLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;
  return (
    <AppProvider>
      <AppLock>
        <Tabs screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2F78C9",
          tabBarInactiveTintColor: "#8B97A7",
          tabBarButton: HapticTab,
          tabBarLabelStyle: styles.label,
          tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: "#FFFFFF", borderTopColor: "#DCE4EF", borderTopWidth: 0.5 },
        }}>
          <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size ?? 23} /> }} />
          <Tabs.Screen name="consumer" options={{ title: "المستهلك", tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" color={color} size={size ?? 23} /> }} />
          <Tabs.Screen name="boxes" options={{ title: "الصناديق", tabBarIcon: ({ color, size }) => <Ionicons name="file-tray-full-outline" color={color} size={size ?? 23} /> }} />
          <Tabs.Screen name="barcodes" options={{ title: "الباركود", tabBarIcon: ({ color, size }) => <Ionicons name="barcode-outline" color={color} size={size ?? 23} /> }} />
          <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size ?? 23} /> }} />
          <Tabs.Screen name="archive" options={{ href: null }} />
          <Tabs.Screen name="trash" options={{ href: null }} />
        </Tabs>
      </AppLock>
    </AppProvider>
  );
}

const styles = StyleSheet.create({ label: { fontSize: 11, fontWeight: "700" } });
