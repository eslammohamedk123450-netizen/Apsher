import { Alert, Platform } from "react-native";

/** تأكيد قبل الحذف: نافذة المتصفح على الويب، وتنبيه النظام على الجوال. */
export function confirmAction(
  message: string,
  onConfirm: () => void,
  confirmLabel = "حذف",
) {
  if (Platform.OS === "web") {
    const ok =
      typeof window === "undefined" ? true : window.confirm(message);
    if (ok) onConfirm();
    return;
  }
  Alert.alert("تأكيد", message, [
    { text: "إلغاء", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
