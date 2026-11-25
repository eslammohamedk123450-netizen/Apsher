import { Stack } from "expo-router";

import { AppLock } from "@/components/app-lock";
import { AppProvider } from "@/lib/local-store";
import { MazraatyProvider } from "@/lib/mazraaty-store";

/**
 * منظومة «مزرعتي»: بياناتها من MazraatyProvider، وقفلها من نفس مصدر
 * «أبشر» (نفس الرقم السري والبصمة) بهوية خضراء خاصة بها.
 */
export default function MazraatyLayout() {
  return (
    <AppProvider>
      <MazraatyProvider>
        <AppLock
          appName="مزرعتي"
          logo={require("@/assets/images/mazraaty-icon.png")}
          accent="#178A5A"
          accentSoft="#E6F6EE"
        >
          <Stack screenOptions={{ headerShown: false }} />
        </AppLock>
      </MazraatyProvider>
    </AppProvider>
  );
}
