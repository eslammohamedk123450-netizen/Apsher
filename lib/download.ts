import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

/**
 * حفظ ملفات التصدير في مجلد «التنزيلات» مباشرةً بدل فتح قائمة المشاركة.
 *
 * - ويب: تنزيل حقيقي من المتصفح (يظهر في Downloads).
 * - أندرويد: صلاحية مجلد التحميلات مرة واحدة، ثم كتابة مباشرة في كل مرة.
 * - iOS: لا يوجد مجلد تنزيلات عام، نستخدم «حفظ في الملفات» كبديل.
 */

const DOWNLOAD_DIR_KEY = "supernotes.downloads.dir.uri";

export type DownloadResult = "downloads" | "shared" | "cancelled" | "failed";

const sanitizeName = (name: string) =>
  name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "download";

/** يطلب تأكيدًا من المستخدم قبل التنزيل (محليًا فقط). */
function askConfirm(fileName: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      "تنزيل الملف",
      `سيتم حفظ «${fileName}» في مجلد التنزيلات.`,
      [
        { text: "إلغاء", style: "cancel", onPress: () => resolve(false) },
        { text: "تنزيل", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function downloadOnWeb(fileName: string, base64: string, mimeType: string) {
  if (typeof document === "undefined") return false;
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

async function shareFallback(
  fileName: string,
  base64: string,
  mimeType: string,
): Promise<DownloadResult> {
  try {
    if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
      return "failed";
    }
    const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!root) return "failed";
    const path = `${root}${fileName}`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Sharing.shareAsync(path, {
      mimeType,
      dialogTitle: "حفظ الملف",
      UTI: mimeType,
    });
    return "shared";
  } catch {
    return "failed";
  }
}

/** يحفظ ملفًا مُرمّزًا base64 في التنزيلات. */
export async function saveBase64ToDownloads(
  fileName: string,
  base64: string,
  mimeType: string,
): Promise<DownloadResult> {
  const safeName = sanitizeName(fileName);

  if (!(await askConfirm(safeName))) return "cancelled";

  if (Platform.OS === "web") {
    return downloadOnWeb(safeName, base64, mimeType) ? "downloads" : "failed";
  }

  if (Platform.OS === "android") {
    try {
      let dirUri = await AsyncStorage.getItem(DOWNLOAD_DIR_KEY);
      if (!dirUri) {
        let permission;
        try {
          const initialUri =
            FileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
              "Download",
            );
          permission =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
              initialUri,
            );
        } catch {
          permission =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        }
        if (!permission.granted) return "cancelled";
        dirUri = permission.directoryUri;
        await AsyncStorage.setItem(DOWNLOAD_DIR_KEY, dirUri);
      }

      const fileUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          dirUri,
          safeName,
          mimeType,
        );
      await FileSystem.StorageAccessFramework.writeAsStringAsync(
        fileUri,
        base64,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      return "downloads";
    } catch {
      // صلاحية قديمة أو ملغاة: نمسحها ونستخدم قائمة المشاركة كبديل.
      await AsyncStorage.removeItem(DOWNLOAD_DIR_KEY);
      return shareFallback(safeName, base64, mimeType);
    }
  }

  return shareFallback(safeName, base64, mimeType);
}

/** يحوّل نصًا (UTF-8) إلى base64. */
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(text, "utf8").toString("base64");
}

/** يحفظ ملفًا نصيًا (JSON مثلًا) في التنزيلات. */
export async function saveTextToDownloads(
  fileName: string,
  text: string,
  mimeType: string,
): Promise<DownloadResult> {
  return saveBase64ToDownloads(fileName, textToBase64(text), mimeType);
}

/** رسالة للمستخدم بعد محاولة التنزيل. */
export function downloadResultMessage(result: DownloadResult): string | null {
  switch (result) {
    case "downloads":
      return "تم التنزيل في مجلد التنزيلات.";
    case "shared":
      return "اختر «حفظ في الملفات» لإتمام حفظ النسخة.";
    case "cancelled":
      return "تم إلغاء التنزيل.";
    default:
      return "تعذر حفظ الملف. جرّب مرة أخرى.";
  }
}