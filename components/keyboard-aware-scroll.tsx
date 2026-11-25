import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * منطقة تمرير تحافظ على ظهور خانة الكتابة فوق لوحة المفاتيح.
 *
 * - على iOS: يزيح المحتوى لأعلى بمقدار ارتفاع لوحة المفاتيح.
 * - على Android: يعتمد على وضع "resize" في النظام مع تصغير المساحة،
 *   فيبقى الحقل النشط مرئيًا وقابلًا للتمرير.
 *
 * يُستخدم في الفورمات الكاملة والنوافذ بدل ScrollView العادي.
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}