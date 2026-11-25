import BarcodeScanning from "@react-native-ml-kit/barcode-scanning";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/**
 * قراءة الباركود من صورة:
 * - على أندرويد/iOS نستخدم Google ML Kit (يعمل على الصور المحلية).
 * - على الويب نستخدم واجهة BarcodeDetector المدمجة في المتصفح إن توفّرت.
 */

/** يختار صورة من المعرض بدون قصّ حتى لا يُقتطع الباركود. */
export async function pickBarcodeImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("اسمح للتطبيق بالوصول إلى الصور لقراءة الباركود.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};

async function decodeOnWeb(uri: string): Promise<string | null> {
  const Detector = (
    globalThis as unknown as { BarcodeDetector?: new () => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (!Detector) return null;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("تعذر فتح الصورة"));
    element.src = uri;
  });
  const found = await new Detector().detect(image);
  return found?.[0]?.rawValue ?? null;
}

/** يفكّ باركود من صورة ويعيد أول قيمة مقروءة، أو null إن لم يُوجد. */
export async function decodeBarcodeFromImage(
  uri: string,
): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return await decodeOnWeb(uri);
    } catch {
      return null;
    }
  }
  try {
    const codes = await BarcodeScanning.scan(uri);
    return codes?.[0]?.value ?? null;
  } catch {
    return null;
  }
}
