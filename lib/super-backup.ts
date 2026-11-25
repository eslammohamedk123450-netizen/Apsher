import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import JSZip from "jszip";

import {
  saveBase64ToDownloads,
  type DownloadResult,
} from "@/lib/download";
import {
  makeId,
  mergeApsherDataIntoStorage,
  type AppData as ApsherData,
} from "@/lib/local-store";
import type { MazraatyData } from "@/lib/mazraaty-store";

/**
 * النسخ الاحتياطي على مستوى التطبيق الكامل.
 *
 * ملف ZIP واحد فيه فولدر لكل منظومة:
 *   manifest.json
 *   apsher/    data.json + images/
 *   mazraaty/  data.json + images/ + audio/
 *
 * كل بيانات المنظومة تُقرأ من مفاتيح AsyncStorage الخاصة بها، والوسائط
 * (الصور والصوت) تُضمَّن داخل الملف حتى تنتقل بين الأجهزة.
 */

export const APSHER_DATA_KEY = "emsir.app.data.v1";
export const MAZRAATY_DATA_KEY = "mazraaty.app.data.v1";

const COMBINED_SIGNATURE = "SUPER-NOTES-BACKUP-V1";
const MAZRAATY_SIGNATURE = "MAZRAATY-BACKUP-V1";
const APSHER_SIGNATURE = "APSHER-BACKUP-V1";

const now = () => new Date().toISOString();
const stamp = () => now().replace(/[.:]/g, "-");
const documentRoot = () =>
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "") || makeId("media");
}

function base64ToText(base64: string) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  if (typeof TextDecoder !== "undefined")
    return new TextDecoder("utf-8").decode(bytes);
  return decodeURIComponent(escape(binary));
}

function extFor(uri: string, isAudio: boolean) {
  const data = /^data:([^;,]+)[;,]/.exec(uri);
  if (data) {
    const mime = data[1];
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("wav")) return "wav";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  }
  const file = /\.([a-z0-9]+)(?:\?|$)/i.exec(uri);
  if (file) return file[1].toLowerCase();
  return isAudio ? "m4a" : "jpg";
}

function mimeFor(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "webm":
      return "audio/webm";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "mp4":
    case "m4a":
      return "audio/mp4";
    default:
      return "image/jpeg";
  }
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri.split(",")[1] ?? "";
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("تعذر قراءة الوسيط"));
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function saveMedia(name: string, base64: string): Promise<string> {
  const ext = (/\.[a-z0-9]+$/i.exec(name)?.[0] ?? ".jpg").slice(1).toLowerCase();
  const mime = mimeFor(ext);
  const root = documentRoot();
  if (Platform.OS === "web" || !root) return `data:${mime};base64,${base64}`;
  const destination = `${root}super-restored-${safeName(name)}`;
  await FileSystem.writeAsStringAsync(destination, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destination;
}

/** يمشي على الكائن ويحوّل كل imageUri/audioUri إلى مرجع داخل الـ ZIP. */
async function embedMedia(
  node: unknown,
  zip: JSZip,
  prefix: string,
  cache: Map<string, string>,
): Promise<void> {
  if (Array.isArray(node)) {
    for (const item of node) await embedMedia(item, zip, prefix, cache);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (
      (key === "imageUri" || key === "audioUri") &&
      typeof value === "string" &&
      value
    ) {
      record[key] = await embedOne(
        value,
        zip,
        prefix,
        cache,
        key === "audioUri",
      );
    } else {
      await embedMedia(value, zip, prefix, cache);
    }
  }
}

async function embedOne(
  uri: string,
  zip: JSZip,
  prefix: string,
  cache: Map<string, string>,
  isAudio: boolean,
): Promise<string> {
  if (cache.has(uri)) return cache.get(uri)!;
  try {
    const base64 = await uriToBase64(uri);
    const ext = extFor(uri, isAudio);
    const folder = isAudio ? "audio" : "images";
    const name = `${folder}-${cache.size + 1}-${safeName(makeId("m"))}.${ext}`;
    zip.file(`${prefix}/${folder}/${name}`, base64, { base64: true });
    const reference = `@media/${folder}/${name}`;
    cache.set(uri, reference);
    return reference;
  } catch {
    return uri;
  }
}

/** يستعيد المراجع @media/... من الـ ZIP إلى ملفات محلية. */
async function restoreMedia(
  node: unknown,
  zip: JSZip,
  prefix: string,
  cache: Map<string, string>,
): Promise<void> {
  if (Array.isArray(node)) {
    for (const item of node) await restoreMedia(item, zip, prefix, cache);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === "string" && value.startsWith("@media/")) {
      if (cache.has(value)) {
        record[key] = cache.get(value)!;
        continue;
      }
      const relative = value.slice("@media/".length);
      const file = zip.file(`${prefix}/${relative}`);
      if (!file) {
        record[key] = null;
        continue;
      }
      const restored = await saveMedia(
        relative.split("/").pop() ?? relative,
        await file.async("base64"),
      );
      cache.set(value, restored);
      record[key] = restored;
    } else {
      await restoreMedia(value, zip, prefix, cache);
    }
  }
}

async function pickZipBase64(): Promise<{
  base64: string;
  name: string;
  uri: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const base64 =
    asset.base64?.replace(/^data:.*base64,/, "") ??
    (await uriToBase64(asset.uri));
  return { base64, name: asset.name ?? "backup", uri: asset.uri };
}

async function readJsonFromPick(picked: {
  base64: string;
  uri: string;
}): Promise<Record<string, unknown>> {
  if (Platform.OS === "web") return JSON.parse(base64ToText(picked.base64));
  const text = await FileSystem.readAsStringAsync(picked.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return JSON.parse(text);
}

/** يدمج بيانات منظومة أبشر المستوردة مع الموجودة (تُستخدم عند الاسترداد). */
export async function saveApsherPayload(payload: Partial<ApsherData>) {
  await mergeApsherDataIntoStorage(payload);
}

export async function saveMazraatyPayload(payload: Partial<MazraatyData>) {
  await AsyncStorage.setItem(MAZRAATY_DATA_KEY, JSON.stringify(payload));
}

/* ------------------------------------------------------------------ */
/* نسخة مزرعتي لوحدها                                                  */
/* ------------------------------------------------------------------ */

export async function exportMazraatyZip(
  data: MazraatyData,
): Promise<DownloadResult> {
  const zip = new JSZip();
  const payload = JSON.parse(JSON.stringify(data)) as MazraatyData;
  await embedMedia(payload, zip, "mazraaty", new Map());
  zip.file(
    "data.json",
    JSON.stringify(
      { signature: MAZRAATY_SIGNATURE, exportedAt: now(), data: payload },
      null,
      2,
    ),
  );
  zip.file(
    "README.txt",
    "نسخة احتياطية من منظومة مزرعتي\n\nاستورد هذا الملف من إعدادات مزرعتي لاستعادة الأقسام والعناصر والملاحظات مع الصور والتسجيلات.\n",
  );
  const base64 = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return saveBase64ToDownloads(
    `mazraaty-backup-${stamp()}.zip`,
    base64,
    "application/zip",
  );
}

export async function importMazraatyBackup(): Promise<Partial<MazraatyData> | null> {
  const picked = await pickZipBase64();
  if (!picked) return null;

  let zip: JSZip | null = null;
  try {
    zip = await JSZip.loadAsync(picked.base64, { base64: true });
  } catch {
    zip = null;
  }

  if (zip) {
    const file =
      zip.file("mazraaty/data.json") ?? zip.file("data.json");
    if (file) {
      const parsed = JSON.parse(await file.async("string")) as Record<
        string,
        unknown
      >;
      const payload = (parsed.data ?? parsed) as Partial<MazraatyData>;
      const copy = JSON.parse(JSON.stringify(payload));
      await restoreMedia(copy, zip, "mazraaty", new Map());
      return copy;
    }
    throw new Error("ملف ZIP لا يحتوي على بيانات مزرعتي.");
  }

  const parsed = await readJsonFromPick(picked);
  return (parsed.data ?? parsed) as Partial<MazraatyData>;
}

/* ------------------------------------------------------------------ */
/* النسخة الكاملة (كل المنظومات)                                       */
/* ------------------------------------------------------------------ */

export async function exportSuperNotesBackup(): Promise<DownloadResult> {
  const [apsherRaw, mazraatyRaw] = await Promise.all([
    AsyncStorage.getItem(APSHER_DATA_KEY),
    AsyncStorage.getItem(MAZRAATY_DATA_KEY),
  ]);

  const zip = new JSZip();
  const systems: string[] = [];

  if (apsherRaw) {
    try {
      const apsher = JSON.parse(apsherRaw) as Record<string, unknown>;
      await embedMedia(apsher, zip, "apsher", new Map());
      zip.file("apsher/data.json", JSON.stringify(apsher, null, 2));
      systems.push("apsher");
    } catch {
      /* تجاهل بيانات أبشر التالفة */
    }
  }

  if (mazraatyRaw) {
    try {
      const mazraaty = JSON.parse(mazraatyRaw) as Record<string, unknown>;
      await embedMedia(mazraaty, zip, "mazraaty", new Map());
      zip.file("mazraaty/data.json", JSON.stringify(mazraaty, null, 2));
      systems.push("mazraaty");
    } catch {
      /* تجاهل بيانات مزرعتي التالفة */
    }
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        signature: COMBINED_SIGNATURE,
        appName: "Super Notes",
        formatVersion: 1,
        systems,
        exportedAt: now(),
      },
      null,
      2,
    ),
  );
  zip.file(
    "README.txt",
    "نسخة احتياطية من تطبيق Super Notes\n\nتحتوي على فولدر لكل منظومة:\n  apsher/   منظومة أبشر (data.json + images/)\n  mazraaty/ منظومة مزرعتي (data.json + images/ + audio/)\n\nاستورد الملف من إعدادات أي منظومة لاستعادة كل المنظومات معًا.\n",
  );

  const base64 = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return saveBase64ToDownloads(
    `super-notes-backup-${stamp()}.zip`,
    base64,
    "application/zip",
  );
}

export type SuperImportResult = {
  /** بيانات أبشر الجاهزة (بدون حفظ) إن وُجدت في النسخة. */
  apsher: Record<string, unknown> | null;
  /** بيانات مزرعتي الجاهزة (بدون حفظ) إن وُجدت في النسخة. */
  mazraaty: Partial<MazraatyData> | null;
};

export async function importSuperNotesBackup(): Promise<SuperImportResult | null> {
  const picked = await pickZipBase64();
  if (!picked) return null;

  let zip: JSZip | null = null;
  try {
    zip = await JSZip.loadAsync(picked.base64, { base64: true });
  } catch {
    zip = null;
  }

  // ملف JSON مفرد (نسخة أبشر القديمة أو نسخة مزرعتي).
  if (!zip) {
    const parsed = await readJsonFromPick(picked);
    const payload = (parsed.data ?? parsed) as Record<string, unknown>;
    if (parsed.signature === APSHER_SIGNATURE) {
      return { apsher: payload, mazraaty: null };
    }
    return { apsher: null, mazraaty: payload as Partial<MazraatyData> };
  }

  const manifestFile = zip.file("manifest.json");
  const apsherFile = zip.file("apsher/data.json");
  const mazraatyFile = zip.file("mazraaty/data.json");

  // نسخة منظومة واحدة (بدون manifest): نحدد النوع من التوقيع/الحقول.
  if (!manifestFile && !apsherFile && !mazraatyFile) {
    const rootFile = zip.file("data.json");
    if (!rootFile) throw new Error("الملف ليس نسخة صالحة من Super Notes.");
    const parsed = JSON.parse(await rootFile.async("string")) as Record<
      string,
      unknown
    >;
    if (parsed.signature === APSHER_SIGNATURE) {
      const payload = (parsed.data ?? {}) as Record<string, unknown>;
      await restoreMedia(payload, zip, "", new Map());
      return { apsher: payload, mazraaty: null };
    }
    if (
      parsed.signature === MAZRAATY_SIGNATURE ||
      (typeof parsed.data === "object" && parsed.data !== null)
    ) {
      const payload = (parsed.data ?? parsed) as Partial<MazraatyData>;
      const copy = JSON.parse(JSON.stringify(payload));
      await restoreMedia(copy, zip, "mazraaty", new Map());
      return { apsher: null, mazraaty: copy };
    }
    // نسخة أبشر قديمة بدون توقيع لكن فيها data.json في الجذر.
    const payload = (parsed.data ?? parsed) as Record<string, unknown>;
    await restoreMedia(payload, zip, "", new Map());
    return { apsher: payload, mazraaty: null };
  }

  let apsher: Record<string, unknown> | null = null;
  let mazraaty: Partial<MazraatyData> | null = null;

  if (apsherFile) {
    const parsed = JSON.parse(await apsherFile.async("string")) as Record<
      string,
      unknown
    >;
    const payload = (parsed.data ?? parsed) as Record<string, unknown>;
    await restoreMedia(payload, zip, "apsher", new Map());
    apsher = payload;
  }

  if (mazraatyFile) {
    const parsed = JSON.parse(await mazraatyFile.async("string")) as Record<
      string,
      unknown
    >;
    const payload = (parsed.data ?? parsed) as Partial<MazraatyData>;
    const copy = JSON.parse(JSON.stringify(payload));
    await restoreMedia(copy, zip, "mazraaty", new Map());
    mazraaty = copy;
  }

  if (!apsher && !mazraaty)
    throw new Error("الملف ليس نسخة صالحة من Super Notes.");

  return { apsher, mazraaty };
}
