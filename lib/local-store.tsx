import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import JSZip from "jszip";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  saveBase64ToDownloads,
  saveTextToDownloads,
  type DownloadResult,
} from "@/lib/download";

export type Section = {
  id: string;
  name: string;
  imageUri?: string | null;
  createdAt: string;
  archivedAt?: string | null;
};

export type Product = {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  quantity: number;
  barcode: string;
  imageUri?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type BoxItem = {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  imageUri?: string | null;
  /** Historical product codes retained for lookup while item is inside a box. */
  barcodeAliases?: string[];
  /** Barcode used by older exports before aliases were introduced. */
  barcode?: string;
  status: "available" | "consumed" | "removed";
  addedAt: string;
  consumedAt?: string;
};

export type Box = {
  id: string;
  barcode: string;
  name: string;
  description: string;
  imageUri?: string | null;
  items: BoxItem[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type ConsumerRecord = {
  id: string;
  productId: string;
  productSnapshot: Product;
  sectionName: string;
  usageDescription: string;
  consumedQuantity: number;
  consumedAt: string;
  addedAt: string;
};

export type ApsherRetention = "24h" | "7d" | "30d" | "never";

export type ApsherTrashKind = "section" | "product" | "box";

export type ApsherTrashEntry = {
  id: string;
  kind: ApsherTrashKind;
  title: string;
  imageUri?: string | null;
  deletedAt: string;
  /** لقطة كاملة للقسم مع منتجاته */
  section?: Section;
  products?: Product[];
  /** لقطة لمنتج واحد */
  product?: Product;
  /** لقطة لصندوق بمحتوياته */
  box?: Box;
};

export type ApsherSettings = {
  trashRetention: ApsherRetention;
};

export const DEFAULT_APSHER_SETTINGS: ApsherSettings = { trashRetention: "7d" };

export const APSHER_RETENTION_OPTIONS: {
  value: ApsherRetention;
  label: string;
}[] = [
  { value: "24h", label: "كل 24 ساعة" },
  { value: "7d", label: "كل 7 أيام" },
  { value: "30d", label: "كل 30 يومًا" },
  { value: "never", label: "أبدًا (لا تحذف تلقائيًا)" },
];

export const apsherRetentionMs = (value: ApsherRetention): number | null => {
  switch (value) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};

export type AppData = {
  version: 2;
  sections: Section[];
  products: Product[];
  boxes: Box[];
  consumerRecords: ConsumerRecord[];
  trash: ApsherTrashEntry[];
  settings: ApsherSettings;
  updatedAt: string;
};

type AppContextValue = {
  data: AppData;
  ready: boolean;
  autoStatus: string;
  deviceBackupEnabled: boolean;
  pin: string | null;
  biometricEnabled: boolean;
  commit: (
    updater: AppData | ((previous: AppData) => AppData),
  ) => Promise<void>;
  replaceData: (incoming: Partial<AppData>) => Promise<void>;
  mergeData: (incoming: Partial<AppData>) => Promise<void>;
  archiveSection: (id: string, archived: boolean) => void;
  archiveProduct: (id: string, archived: boolean) => void;
  archiveBox: (id: string, archived: boolean) => void;
  removeSection: (id: string) => void;
  removeProduct: (id: string) => void;
  removeBox: (id: string) => void;
  restoreTrash: (id: string) => void;
  purgeTrash: (id: string) => void;
  emptyTrash: () => void;
  setTrashRetention: (value: ApsherRetention) => void;
  exportCurrent: () => Promise<DownloadResult>;
  exportZip: () => Promise<DownloadResult>;
  enableDeviceBackup: () => Promise<boolean>;
  importZip: () => Promise<boolean>;
  importAsBox: () => Promise<string | null>;
  setPin: (value: string | null) => Promise<void>;
  setBiometric: (value: boolean) => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  pickImage: () => Promise<string | null>;
};

const DATA_KEY = "emsir.app.data.v1";
// مفتاح مخزن منظومة «مزرعتي»، لضمّ بياناتها في النسخة الاحتياطية على
// مستوى التطبيق. نستخدم القيمة النصية لتفادي الاستيراد الدائري.
const MAZRAATY_DATA_KEY = "mazraaty.app.data.v1";
const PIN_KEY = "emsir.app.pin";
const BIOMETRIC_KEY = "emsir.app.biometric";
const META_KEY = "emsir.app.backup.meta";
const DEVICE_BACKUP_URI_KEY = "emsir.app.device-backup-uri";
const BACKUP_APP_ID = "apsher.inventory";
const BACKUP_SIGNATURE = "APSHER-BACKUP-V1";
const BACKUP_FILE_NAME = "Apsher-auto-backup.json";
const now = () => new Date().toISOString();

// نقل منتج من العام إلى الصندوق (حذف من العام، إضافة للصندوق)
export const moveProductToBox =
  (productId: string, boxId: string) =>
  (previous: AppData): AppData => {
    const product = previous.products.find((p) => p.id === productId);
    if (!product) return previous;
    return {
      ...previous,
      products: previous.products.filter((p) => p.id !== productId),
      boxes: previous.boxes.map((b) =>
        b.id === boxId
          ? {
              ...b,
              items: [
                ...b.items,
                {
                  id: makeId("box-item"),
                  productId: product.id,
                  productName: product.name,
                  description: product.description,
                  quantity: product.quantity,
                  imageUri: product.imageUri ?? null,
                  barcodeAliases: product.barcode ? [product.barcode] : [],
                  status: "available" as const,
                  addedAt: now(),
                },
              ],
              updatedAt: now(),
            }
          : b,
      ),
    };
  };

// نقل منتج من الصندوق إلى العام (حذف من الصندوق، إضافة للعام)
export const moveProductToGeneral =
  (boxId: string, itemId: string) =>
  (previous: AppData): AppData => {
    const fallbackSectionId = previous.sections[0]?.id ?? makeId("section");
    const sections = previous.sections.length
      ? previous.sections
      : [
          ...previous.sections,
          {
            id: fallbackSectionId,
            name: "منقول من الصناديق",
            createdAt: now(),
          },
        ];
    let movedProduct: Product | null = null;
    const nextBoxes = previous.boxes.map((b) => {
      if (b.id !== boxId) return b;
      const item = b.items.find((i) => i.id === itemId);
      if (item) {
        movedProduct = {
          id: item.productId,
          sectionId: fallbackSectionId,
          name: item.productName,
          description: item.description || "منقول من صندوق",
          quantity: item.quantity,
          barcode: item.barcodeAliases?.[0] || makeBarcode("product"),
          imageUri: item.imageUri ?? null,
          createdAt: now(),
          updatedAt: now(),
        };
        return {
          ...b,
          items: b.items.filter((i) => i.id !== itemId),
          updatedAt: now(),
        };
      }
      return b;
    });
    return {
      ...previous,
      sections,
      products: movedProduct
        ? [...previous.products, movedProduct]
        : previous.products,
      boxes: nextBoxes,
    };
  };
const stamp = () => now().replace(/[.:]/g, "-");
const documentRoot = () =>
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";

export const emptyData = (): AppData => ({
  version: 2,
  sections: [],
  products: [],
  boxes: [],
  consumerRecords: [],
  trash: [],
  settings: { ...DEFAULT_APSHER_SETTINGS },
  updatedAt: now(),
});

export const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const makeBarcode = (kind: "product" | "box") =>
  `ABS-${kind === "product" ? "P" : "B"}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/**
 * باركود ثابت مشتق من المعرّف، يُستخدم فقط للبيانات القديمة التي لا تحمل
 * باركودًا محفوظًا. لأنه يعتمد على المعرّف الثابت فلا يتغيّر بين التحميلات
 * ولا عند تعديل العنصر، وبذلك تبقى النسخة المطبوعة صالحة.
 */
export const barcodeFromId = (prefix: string, seed: string) => {
  let hash = 0x811c9dc5;
  const text = seed || "barcode";
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const code = (hash >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
    .slice(-7);
  return `${prefix}-${code}`;
};

function normalizeData(input: Partial<AppData>): AppData {
  const products = (Array.isArray(input.products) ? input.products : []).map(
    (product) => ({
      ...product,
      quantity: Number.isFinite(Number((product as Partial<Product>).quantity))
        ? Math.max(0, Number((product as Partial<Product>).quantity))
        : 1,
      barcode:
        typeof (product as Partial<Product>).barcode === "string" &&
        (product as Partial<Product>).barcode
          ? (product as Partial<Product>).barcode
          : barcodeFromId(
              "ABS-P",
              (product as Partial<Product>).id ||
                (product as Partial<Product>).name ||
                "product",
            ),
    }),
  ) as Product[];
  const boxesInput = Array.isArray(input.boxes) ? input.boxes : [];
  const boxes = boxesInput.map((box) => {
    const rawItems = Array.isArray((box as Partial<Box>).items)
      ? (box as Partial<Box>).items
      : [];
    const items = (rawItems as Partial<BoxItem>[]).map((item) => {
      const id =
        typeof item.id === "string" && item.id ? item.id : makeId("box-item");
      const legacyBarcode =
        typeof item.barcode === "string" ? item.barcode.trim() : "";
      const barcodeAliases = Array.from(
        new Set(
          [
            ...(Array.isArray(item.barcodeAliases) ? item.barcodeAliases : []),
            legacyBarcode,
          ].filter(
            (code): code is string =>
              typeof code === "string" && Boolean(code.trim()),
          ),
        ),
      );
      if (!barcodeAliases.length)
        barcodeAliases.push(
          barcodeFromId("ABS-P", id || item.productName || "box-item"),
        );
      const { barcode: _legacyIndividualBarcode, ...itemWithoutBarcode } =
        item as Partial<BoxItem> & { barcode?: string };
      return {
        ...itemWithoutBarcode,
        id,
        description:
          typeof item.description === "string" ? item.description : "",
        quantity: Math.max(1, Number(item.quantity) || 1),
        imageUri: item.imageUri ?? null,
        barcodeAliases,
      };
    });
    return {
      ...box,
      barcode:
        typeof (box as Partial<Box>).barcode === "string" &&
        (box as Partial<Box>).barcode
          ? (box as Partial<Box>).barcode
          : barcodeFromId(
              "ABS-B",
              (box as Partial<Box>).id ||
                (box as Partial<Box>).name ||
                "box",
            ),
      name:
        typeof (box as Partial<Box>).name === "string"
          ? (box as Partial<Box>).name
          : "",
      description:
        typeof (box as Partial<Box>).description === "string"
          ? (box as Partial<Box>).description
          : "",
      items,
    };
  }) as Box[];
  const consumerRecords = (
    Array.isArray(input.consumerRecords) ? input.consumerRecords : []
  ).map((record) => ({
    ...record,
    consumedQuantity: Number.isFinite(
      Number((record as Partial<ConsumerRecord>).consumedQuantity),
    )
      ? Math.max(
          1,
          Number((record as Partial<ConsumerRecord>).consumedQuantity),
        )
      : 1,
  })) as ConsumerRecord[];
  const sectionsInput = Array.isArray(input.sections) ? input.sections : [];
  const sections = sectionsInput.map((section) => ({
    ...section,
    id:
      typeof section?.id === "string" && section.id
        ? section.id
        : makeId("section"),
    name: typeof section?.name === "string" ? section.name : "",
    imageUri: section?.imageUri ?? null,
    createdAt:
      typeof section?.createdAt === "string" ? section.createdAt : now(),
    archivedAt: section?.archivedAt ?? null,
  })) as Section[];
  const trash = (Array.isArray(input.trash) ? input.trash : []).map((entry) => ({
    id:
      typeof entry?.id === "string" && entry.id ? entry.id : makeId("trash"),
    kind:
      entry?.kind === "product" || entry?.kind === "box"
        ? entry.kind
        : ("section" as ApsherTrashKind),
    title: typeof entry?.title === "string" ? entry.title : "",
    imageUri: entry?.imageUri ?? null,
    deletedAt:
      typeof entry?.deletedAt === "string" ? entry.deletedAt : now(),
    section: entry?.section,
    products: Array.isArray(entry?.products) ? entry.products : undefined,
    product: entry?.product,
    box: entry?.box,
  })) as ApsherTrashEntry[];
  const retention: ApsherRetention =
    input.settings?.trashRetention === "24h" ||
    input.settings?.trashRetention === "30d" ||
    input.settings?.trashRetention === "never" ||
    input.settings?.trashRetention === "7d"
      ? input.settings.trashRetention
      : DEFAULT_APSHER_SETTINGS.trashRetention;
  return {
    version: 2,
    sections,
    products,
    boxes,
    consumerRecords,
    trash,
    settings: { trashRetention: retention },
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now(),
  };
}

/** يحذف محذوفات أبشر القديمة حسب مدة الاحتفاظ. */
function purgeExpired(data: AppData): AppData {
  const window = apsherRetentionMs(data.settings.trashRetention);
  if (window === null) return data;
  const cutoff = Date.now() - window;
  const trash = data.trash.filter(
    (entry) => new Date(entry.deletedAt).getTime() >= cutoff,
  );
  return trash.length === data.trash.length ? data : { ...data, trash };
}

/**
 * دمج نسخة مستوردة مع البيانات الحالية:
 * - الأقسام تتطابق بالاسم، فيُضاف المحتوى للقسم الموجود أو يُنشأ قسم جديد.
 * - المنتجات تتبع قسمها الأصلي في النسخة بعد إعادة الربط.
 * - الصناديق وسجل الاستهلاك والمحذوفات تُضاف.
 */
function mergeAppData(current: AppData, incoming: Partial<AppData>): AppData {
  const next: AppData = {
    ...current,
    sections: [...current.sections],
    products: [...current.products],
    boxes: [...current.boxes],
    consumerRecords: [...current.consumerRecords],
    trash: [...current.trash],
  };

  const sectionByName = new Map<string, Section>();
  for (const section of next.sections)
    sectionByName.set(section.name.trim(), section);

  const sectionIdMap = new Map<string, string>();
  for (const source of normalizeData({ sections: incoming.sections }).sections) {
    const key = source.name.trim();
    const existing = key ? sectionByName.get(key) : undefined;
    if (existing) {
      if (!existing.imageUri && source.imageUri) {
        const merged = { ...existing, imageUri: source.imageUri };
        const at = next.sections.indexOf(existing);
        if (at >= 0) next.sections[at] = merged;
        sectionByName.set(key, merged);
      }
      sectionIdMap.set(source.id, existing.id);
    } else {
      const id = next.sections.some((s) => s.id === source.id)
        ? makeId("section")
        : source.id;
      const created = { ...source, id };
      next.sections.push(created);
      sectionIdMap.set(source.id, id);
      if (key) sectionByName.set(key, created);
    }
  }

  const productIds = new Set(next.products.map((p) => p.id));
  for (const source of normalizeData({ products: incoming.products }).products) {
    const sectionId = sectionIdMap.get(source.sectionId) ?? source.sectionId;
    if (!next.sections.some((s) => s.id === sectionId)) continue;
    const id = productIds.has(source.id) ? makeId("product") : source.id;
    productIds.add(id);
    next.products.push({ ...source, id, sectionId });
  }

  const boxNames = new Set(next.boxes.map((b) => b.name.trim()).filter(Boolean));
  for (const box of normalizeData({ boxes: incoming.boxes }).boxes) {
    const key = box.name.trim();
    if (key && boxNames.has(key)) continue;
    const id = next.boxes.some((b) => b.id === box.id) ? makeId("box") : box.id;
    if (key) boxNames.add(key);
    next.boxes.push({ ...box, id });
  }

  const recordIds = new Set(next.consumerRecords.map((r) => r.id));
  for (const record of incoming.consumerRecords ?? []) {
    if (recordIds.has(record.id)) continue;
    recordIds.add(record.id);
    next.consumerRecords.push(record);
  }

  for (const entry of normalizeData({ trash: incoming.trash }).trash) {
    if (next.trash.some((t) => t.id === entry.id)) continue;
    next.trash.push(entry);
  }

  return next;
}

function dataFingerprint(data: AppData) {
  const text = JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createBackupFile(data: AppData, lastSyncedAt = now()) {
  return {
    signature: BACKUP_SIGNATURE,
    appId: BACKUP_APP_ID,
    formatVersion: 1,
    lastSyncedAt,
    fingerprint: dataFingerprint(data),
    data,
  };
}

/**
 * النسخة الاحتياطية على مستوى التطبيق: نفس ملف أبشر مع إضافة بيانات بقية
 * المنظومات (مزرعتي) في الحقل superNotes. تبقى بصمة أبشر وحقوله كما هي،
 * لذا تعمل النسخة مع أي إصدار قديم، وتتجاهلها النسخ القديمة إن لم تعرفها.
 */
async function readSuperNotesPayload() {
  try {
    const raw = await AsyncStorage.getItem(MAZRAATY_DATA_KEY);
    if (!raw) return null;
    const mazraaty = JSON.parse(raw) as unknown;
    return { mazraaty };
  } catch {
    return null;
  }
}

async function createAppBackupFile(data: AppData, lastSyncedAt = now()) {
  const base = createBackupFile(data, lastSyncedAt);
  const superNotes = await readSuperNotesPayload();
  return superNotes ? { ...base, superNotes } : base;
}

function unpackBackupFile(raw: unknown): Partial<AppData> {
  if (!raw || typeof raw !== "object") throw new Error("ملف النسخة غير صالح.");
  const backup = raw as Record<string, unknown>;
  if (backup.signature !== undefined) {
    if (
      backup.signature !== BACKUP_SIGNATURE ||
      backup.appId !== BACKUP_APP_ID
    ) {
      throw new Error("هذه النسخة ليست نسخة تطبيق أبشر.");
    }
    const data = backup.data as Partial<AppData> | undefined;
    if (
      !data ||
      typeof data !== "object" ||
      backup.fingerprint !== dataFingerprint(data as AppData)
    ) {
      throw new Error(
        "تعذر التحقق من بصمة الملف؛ قد تكون النسخة تالفة أو معدّلة.",
      );
    }
    return data;
  }
  return raw as Partial<AppData>;
}

async function writeAutoBackup(data: AppData) {
  const root = documentRoot();
  if (!root) return null;
  const path = `${root}${BACKUP_FILE_NAME}`;
  const syncedAt = now();
  await FileSystem.writeAsStringAsync(
    path,
    JSON.stringify(await createAppBackupFile(data, syncedAt), null, 2),
    {
      encoding: FileSystem.EncodingType.UTF8,
    },
  );
  await AsyncStorage.setItem(
    META_KEY,
    JSON.stringify({
      path,
      exportedAt: syncedAt,
      signature: BACKUP_SIGNATURE,
      fingerprint: dataFingerprint(data),
    }),
  );
  return path;
}

async function persist(data: AppData): Promise<boolean | null> {
  // الحفظ الفوري للبيانات في التخزين المحلي (سريع دائمًا).
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
  // كتابة ملف النسخة التلقائية تُجمَّع (debounce) لتفادي إعادة الكتابة مع كل تغيير.
  syncAppBackupFile();
  const fileUri = await AsyncStorage.getItem(DEVICE_BACKUP_URI_KEY);
  return fileUri ? true : null;
}

/**
 * ينفّذ فعليًا كتابة ملف النسخة التلقائية داخل التطبيق + الملف المشترك،
 * اعتمادًا على أحدث بيانات محفوظة في التخزين المحلي.
 */
async function performAppBackupSync(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const data = normalizeData(JSON.parse(raw) as Partial<AppData>);
    await writeAutoBackup(data);
    const fileUri = await AsyncStorage.getItem(DEVICE_BACKUP_URI_KEY);
    if (fileUri) {
      try {
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          fileUri,
          JSON.stringify(await createAppBackupFile(data), null, 2),
          { encoding: FileSystem.EncodingType.UTF8 },
        );
        return true;
      } catch {
        await AsyncStorage.removeItem(DEVICE_BACKUP_URI_KEY);
        return false;
      }
    }
    return null;
  } catch {
    /* تجاهل أخطاء النسخة التلقائية؛ الحفظ المحلي تم بالفعل */
    return null;
  }
}

let backupSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * يجدول مزامنة ملف النسخة التلقائية بعد تجميع التغييرات (١.٥ ثانية).
 * البيانات نفسها تُحفظ فورًا في التخزين المحلي؛ هذا فقط للملف الثقيل.
 */
export function syncAppBackupFile(): void {
  if (backupSyncTimer) clearTimeout(backupSyncTimer);
  backupSyncTimer = setTimeout(() => {
    backupSyncTimer = null;
    void performAppBackupSync();
  }, 1500);
}

/** يفرض مزامنة فورية (عند خروج التطبيق للخلفية أو قبل الإغلاق). */
export async function flushAppBackupSync(): Promise<void> {
  if (backupSyncTimer) {
    clearTimeout(backupSyncTimer);
    backupSyncTimer = null;
  }
  await performAppBackupSync();
}

/** مسار ملف الحفظ التلقائي على الجهاز (لعرضه للمستخدم). */
export function getAutoBackupPath(): string | null {
  const root = documentRoot();
  return root ? `${root}${BACKUP_FILE_NAME}` : null;
}

/** يدمج بيانات أبشر مستوردة داخل التخزين المحلي دون استبدال الموجود. */
export async function mergeApsherDataIntoStorage(
  payload: Partial<AppData>,
): Promise<AppData> {
  const raw = await AsyncStorage.getItem(DATA_KEY);
  const current = raw
    ? normalizeData(JSON.parse(raw) as Partial<AppData>)
    : emptyData();
  const next = mergeAppData(current, payload);
  next.updatedAt = now();
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(next));
  await syncAppBackupFile();
  return next;
}

async function uriToBase64(uri: string) {
  if (uri.startsWith("data:")) return uri.split(",")[1] ?? "";
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function saveBase64Image(path: string, base64: string) {
  const root = documentRoot();
  if (!root) return `data:image/jpeg;base64,${base64}`;
  const safeName =
    path
      .split("/")
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/g, "") || `${makeId("image")}.jpg`;
  const destination = `${root}emsir-restored-${safeName}`;
  await FileSystem.writeAsStringAsync(destination, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destination;
}

export async function exportDataJson(
  data: AppData,
): Promise<DownloadResult> {
  const text = JSON.stringify(createBackupFile(data), null, 2);
  return saveTextToDownloads(
    `emsir-backup-${stamp()}.json`,
    text,
    "application/json",
  );
}

export async function exportDataZip(
  data: AppData,
): Promise<DownloadResult> {
  const zip = new JSZip();
  const imageRefs: Record<string, string> = {};
  const products = [] as Product[];
  const addImage = async (uri: string, fileName: string) => {
    if (imageRefs[uri]) return imageRefs[uri];
    const base64 = await uriToBase64(uri);
    const reference = `images/${fileName}`;
    zip.file(reference, base64, { base64: true });
    imageRefs[uri] = reference;
    return reference;
  };

  const sections: Section[] = [];
  for (const section of data.sections) {
    const copy = { ...section };
    if (section.imageUri) {
      try {
        copy.imageUri = await addImage(
          section.imageUri,
          `section-${section.id}.jpg`,
        );
      } catch {
        copy.imageUri = null;
      }
    }
    sections.push(copy);
  }

  for (const product of data.products) {
    const copy = { ...product };
    if (product.imageUri) {
      try {
        copy.imageUri = await addImage(product.imageUri, `${product.id}.jpg`);
      } catch {
        copy.imageUri = null;
      }
    }
    products.push(copy);
  }

  const boxes: Box[] = [];
  for (const box of data.boxes) {
    const copy = { ...box };
    if (box.imageUri) {
      try {
        copy.imageUri = await addImage(box.imageUri, `box-${box.id}.jpg`);
      } catch {
        copy.imageUri = null;
      }
    }
    copy.items = [];
    for (const item of box.items) {
      const itemCopy = { ...item };
      if (item.imageUri) {
        try {
          itemCopy.imageUri = await addImage(
            item.imageUri,
            `box-item-${item.id}.jpg`,
          );
        } catch {
          itemCopy.imageUri = null;
        }
      }
      copy.items.push(itemCopy);
    }
    boxes.push(copy);
  }
  const consumers: ConsumerRecord[] = [];
  for (const record of data.consumerRecords) {
    const snapshot = { ...record.productSnapshot };
    if (snapshot.imageUri) {
      try {
        snapshot.imageUri = await addImage(
          snapshot.imageUri,
          `consumer-${record.id}.jpg`,
        );
      } catch {
        snapshot.imageUri = null;
      }
    }
    consumers.push({ ...record, productSnapshot: snapshot });
  }

  const exportData = {
    ...data,
    sections,
    products,
    boxes,
    consumerRecords: consumers,
  };
  zip.file("data.json", JSON.stringify(createBackupFile(exportData), null, 2));
  zip.file(
    "README.txt",
    "نسخة احتياطية من تطبيق أبشر\n\nاستورد ملف ZIP من شاشة الإعدادات لاستعادة الأقسام والمنتجات وسجل المستهلك والصور.\n",
  );
  const base64 = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return saveBase64ToDownloads(
    `emsir-backup-${stamp()}.zip`,
    base64,
    "application/zip",
  );
}

export async function importDataZip(): Promise<{
  data: AppData;
  lastSyncedAt?: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "text/json",
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
  let raw: Partial<AppData> | undefined;
  let lastSyncedAt: string | undefined;
  let zip: JSZip | null = null;
  try {
    zip = await JSZip.loadAsync(base64, { base64: true });
  } catch {
    const jsonText =
      Platform.OS === "web"
        ? atob(base64)
        : await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    lastSyncedAt =
      typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : undefined;
    raw = unpackBackupFile(parsed);
    const superNotes = parsed.superNotes as
      | { mazraaty?: unknown }
      | undefined;
    if (superNotes?.mazraaty) {
      await AsyncStorage.setItem(
        MAZRAATY_DATA_KEY,
        JSON.stringify(superNotes.mazraaty),
      );
    }
  }
  const dataFile = zip?.file("data.json");
  if (zip && !dataFile) throw new Error("ملف ZIP لا يحتوي على data.json");
  if (dataFile) {
    const parsed = JSON.parse(await dataFile.async("string")) as Record<
      string,
      unknown
    >;
    lastSyncedAt =
      typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : undefined;
    raw = unpackBackupFile(parsed);
  }
  const imported = normalizeData(raw!);
  const imageCache: Record<string, string> = {};
  const restoreReference = async (reference?: string | null) => {
    if (!reference || !reference.startsWith("images/"))
      return reference ?? null;
    if (imageCache[reference]) return imageCache[reference];
    const file = zip?.file(reference);
    if (!file) return null;
    const restored = await saveBase64Image(
      reference,
      await file.async("base64"),
    );
    imageCache[reference] = restored;
    return restored;
  };
  for (const section of imported.sections)
    section.imageUri = await restoreReference(section.imageUri);
  for (const product of imported.products)
    product.imageUri = await restoreReference(product.imageUri);
  for (const box of imported.boxes) {
    box.imageUri = await restoreReference(box.imageUri);
    for (const item of box.items)
      item.imageUri = await restoreReference(item.imageUri);
  }
  for (const record of imported.consumerRecords) {
    record.productSnapshot.imageUri = await restoreReference(
      record.productSnapshot.imageUri,
    );
  }
  for (const entry of imported.trash) {
    entry.imageUri = await restoreReference(entry.imageUri);
    if (entry.section) entry.section.imageUri = await restoreReference(entry.section.imageUri);
    for (const product of entry.products ?? [])
      product.imageUri = await restoreReference(product.imageUri);
    if (entry.product) entry.product.imageUri = await restoreReference(entry.product.imageUri);
    if (entry.box) entry.box.imageUri = await restoreReference(entry.box.imageUri);
  }
  return { data: imported, lastSyncedAt };
}

// استيراد أي ملف (ZIP أو JSON) وتحويل محتواه إلى صندوق جديد
export async function parseImportedProducts(): Promise<{
  boxName: string;
  products: Array<{
    name: string;
    quantity: number;
    description: string;
    barcodeAliases: string[];
  }>;
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
  let raw: Partial<AppData> | null = null;
  try {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const dataFile = zip.file("data.json");
    if (dataFile)
      raw = unpackBackupFile(JSON.parse(await dataFile.async("string")));
  } catch {
    raw = null;
  }
  if (!raw) {
    try {
      if (Platform.OS === "web")
        raw = unpackBackupFile(JSON.parse(atob(base64)));
      else
        raw = unpackBackupFile(
          JSON.parse(
            await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            }),
          ),
        );
    } catch {
      raw = null;
    }
  }
  if (!raw)
    throw new Error(
      "تعذر قراءة الملف. تأكد أنه ملف ZIP أو JSON مصدّر من أبشر.",
    );
  const products = [
    ...(Array.isArray(raw.products) ? raw.products : []),
    ...(Array.isArray(raw.boxes)
      ? raw.boxes.flatMap((box) =>
          Array.isArray((box as Partial<Box>).items)
            ? (box as Partial<Box>).items!
            : [],
        )
      : []),
  ];
  const boxName =
    String(asset.name ?? "صندوق مستورد").replace(/\.(zip|json)$/i, "") ||
    "صندوق مستورد";
  return {
    boxName,
    products: products.map((entry) => {
      const item = entry as Partial<Product & BoxItem>;
      const barcodeAliases = Array.from(
        new Set(
          [
            ...(Array.isArray(item.barcodeAliases) ? item.barcodeAliases : []),
            typeof item.barcode === "string" ? item.barcode : "",
          ].filter(
            (code): code is string =>
              typeof code === "string" && Boolean(code.trim()),
          ),
        ),
      );
      return {
        name: String(item.name ?? item.productName ?? "منتج"),
        quantity: Math.max(1, Number(item.quantity) || 1),
        description: String(item.description ?? ""),
        barcodeAliases: barcodeAliases.length
          ? barcodeAliases
          : [makeBarcode("product")],
      };
    }),
  };
}

export async function selectDeviceBackupDirectory() {
  if (Platform.OS !== "android")
    throw new Error(
      "المزامنة التلقائية في مجلد مشترك متاحة حاليًا على Android فقط. استخدم تصدير JSON أو ZIP لحفظ نسخة يدويًا.",
    );
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
    permission.directoryUri,
  );
  const existing = files.find((uri) => {
    try {
      return decodeURIComponent(uri).endsWith(BACKUP_FILE_NAME);
    } catch {
      return uri.endsWith(BACKUP_FILE_NAME);
    }
  });
  const fileUri =
    existing ??
    (await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      BACKUP_FILE_NAME,
      "application/json",
    ));
  await AsyncStorage.setItem(DEVICE_BACKUP_URI_KEY, fileUri);
  return true;
}

export async function chooseProductImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("اسمح للتطبيق بالوصول إلى الصور لاختيار صورة المنتج");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const source = result.assets[0].uri;
  if (Platform.OS === "web") return source;
  const root = documentRoot();
  if (!root) return source;
  const destination = `${root}${makeId("product")}.jpg`;
  await FileSystem.copyAsync({ from: source, to: destination });
  return destination;
}

export async function loadInitialState() {
  const readPin = async () => {
    if (Platform.OS === "web") return AsyncStorage.getItem(PIN_KEY);
    const securePin = await SecureStore.getItemAsync(PIN_KEY);
    if (securePin) return securePin;
    const legacyPin = await AsyncStorage.getItem(PIN_KEY);
    if (legacyPin) {
      await SecureStore.setItemAsync(PIN_KEY, legacyPin);
      await AsyncStorage.removeItem(PIN_KEY);
    }
    return legacyPin;
  };
  const [rawData, rawPin, rawBiometric] = await Promise.all([
    AsyncStorage.getItem(DATA_KEY),
    readPin(),
    AsyncStorage.getItem(BIOMETRIC_KEY),
  ]);
  const [backupMeta, deviceBackupUri] = await Promise.all([
    AsyncStorage.getItem(META_KEY),
    AsyncStorage.getItem(DEVICE_BACKUP_URI_KEY),
  ]);
  const rawParsed = rawData ? JSON.parse(rawData) : null;
  const data = rawParsed ? purgeExpired(normalizeData(rawParsed)) : emptyData();
  let effectiveBackupMeta = backupMeta;
  if (rawParsed && JSON.stringify(data) !== JSON.stringify(rawParsed)) {
    await persist(data);
    effectiveBackupMeta = await AsyncStorage.getItem(META_KEY);
  }
  let exportedAt = "";
  try {
    exportedAt = JSON.parse(effectiveBackupMeta ?? "{}").exportedAt ?? "";
  } catch {
    /* Ignore invalid legacy metadata. */
  }
  return {
    data,
    pin: rawPin,
    biometricEnabled: rawBiometric === "true",
    deviceBackupEnabled: Boolean(deviceBackupUri),
    exportedAt,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [pin, setPinState] = useState<string | null>(null);
  const [biometricEnabled, setBiometricState] = useState(false);
  const [deviceBackupEnabled, setDeviceBackupEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoStatus, setAutoStatus] = useState("جاري تجهيز الحفظ المحلي…");

  useEffect(() => {
    loadInitialState()
      .then((state) => {
        setData(state.data);
        setPinState(state.pin);
        setBiometricState(state.biometricEnabled);
        setDeviceBackupEnabled(state.deviceBackupEnabled);
        setAutoStatus(
          state.exportedAt
            ? `آخر مزامنة ${formatDate(state.exportedAt)}`
            : state.data.updatedAt
              ? `آخر حفظ تلقائي ${formatDate(state.data.updatedAt)}`
              : "لم يتم التصدير بعد",
        );
      })
      .catch(() => setAutoStatus("تعذر قراءة النسخة المحلية"))
      .finally(() => setReady(true));
  }, []);

  // عند خروج التطبيق للخلفية نُفرغ أي كتابة مؤجلة لملف النسخة التلقائية فورًا.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        void flushAppBackupSync();
      }
    });
    return () => subscription.remove();
  }, []);

  const commit = useCallback(
    async (updater: AppData | ((previous: AppData) => AppData)) => {
      const next = normalizeData(
        typeof updater === "function" ? updater(data) : updater,
      );
      next.updatedAt = now();
      setData(next);
      setAutoStatus("جاري التصدير التلقائي…");
      try {
        const externalSynced = await persist(next);
        if (externalSynced === true)
          setAutoStatus(
            `تمت المزامنة إلى ملف أبشر · ${formatDate(next.updatedAt)}`,
          );
        else if (externalSynced === false) {
          setDeviceBackupEnabled(false);
          setAutoStatus(
            `تم الحفظ محليًا؛ تعذرت مزامنة الملف المشترك · ${formatDate(next.updatedAt)}`,
          );
        } else
          setAutoStatus(`تم الحفظ تلقائيًا · ${formatDate(next.updatedAt)}`);
      } catch {
        setAutoStatus("تم حفظ البيانات، تعذر إنشاء ملف التصدير التلقائي");
      }
    },
    [data],
  );

  const replaceData = useCallback(async (incoming: Partial<AppData>) => {
    const next = normalizeData(incoming);
    next.updatedAt = now();
    setData(next);
    const externalSynced = await persist(next);
    if (externalSynced === false) setDeviceBackupEnabled(false);
    setAutoStatus(`تم الاسترداد · ${formatDate(next.updatedAt)}`);
  }, []);

  const mergeData = useCallback(
    async (incoming: Partial<AppData>) => {
      const next = mergeAppData(data, incoming);
      next.updatedAt = now();
      setData(next);
      const externalSynced = await persist(next);
      if (externalSynced === false) setDeviceBackupEnabled(false);
      setAutoStatus(`تم الاسترداد والدمج · ${formatDate(next.updatedAt)}`);
    },
    [data],
  );

  const archiveSection = useCallback(
    (id: string, archived: boolean) => {
      commit((previous) => ({
        ...previous,
        sections: previous.sections.map((section) =>
          section.id === id
            ? { ...section, archivedAt: archived ? now() : null }
            : section,
        ),
      }));
    },
    [commit],
  );

  const archiveProduct = useCallback(
    (id: string, archived: boolean) => {
      commit((previous) => ({
        ...previous,
        products: previous.products.map((product) =>
          product.id === id
            ? { ...product, archivedAt: archived ? now() : null }
            : product,
        ),
      }));
    },
    [commit],
  );

  const archiveBox = useCallback(
    (id: string, archived: boolean) => {
      commit((previous) => ({
        ...previous,
        boxes: previous.boxes.map((box) =>
          box.id === id ? { ...box, archivedAt: archived ? now() : null } : box,
        ),
      }));
    },
    [commit],
  );

  const removeSection = useCallback(
    (id: string) => {
      commit((previous) => {
        const section = previous.sections.find((item) => item.id === id);
        if (!section) return previous;
        const products = previous.products.filter(
          (product) => product.sectionId === id,
        );
        const entry: ApsherTrashEntry = {
          id: makeId("trash"),
          kind: "section",
          title: section.name,
          imageUri: section.imageUri ?? null,
          deletedAt: now(),
          section,
          products,
        };
        return {
          ...previous,
          sections: previous.sections.filter((item) => item.id !== id),
          products: previous.products.filter(
            (product) => product.sectionId !== id,
          ),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const removeProduct = useCallback(
    (id: string) => {
      commit((previous) => {
        const product = previous.products.find((item) => item.id === id);
        if (!product) return previous;
        const entry: ApsherTrashEntry = {
          id: makeId("trash"),
          kind: "product",
          title: product.name,
          imageUri: product.imageUri ?? null,
          deletedAt: now(),
          product,
        };
        return {
          ...previous,
          products: previous.products.filter((item) => item.id !== id),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const removeBox = useCallback(
    (id: string) => {
      commit((previous) => {
        const box = previous.boxes.find((item) => item.id === id);
        if (!box) return previous;
        const entry: ApsherTrashEntry = {
          id: makeId("trash"),
          kind: "box",
          title: box.name,
          imageUri: box.imageUri ?? null,
          deletedAt: now(),
          box,
        };
        return {
          ...previous,
          boxes: previous.boxes.filter((item) => item.id !== id),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const restoreTrash = useCallback(
    (id: string) => {
      commit((previous) => {
        const entry = previous.trash.find((item) => item.id === id);
        if (!entry) return previous;
        const trash = previous.trash.filter((item) => item.id !== id);
        if (entry.kind === "section" && entry.section) {
          const conflict = previous.sections.some(
            (section) => section.id === entry.section!.id,
          );
          const sectionId = conflict ? makeId("section") : entry.section.id;
          const section = { ...entry.section, id: sectionId, archivedAt: null };
          const productIds = new Set(previous.products.map((p) => p.id));
          const restoredProducts = (entry.products ?? []).map((product) => {
            const productId = productIds.has(product.id)
              ? makeId("product")
              : product.id;
            return {
              ...product,
              id: productId,
              sectionId,
              archivedAt: null,
            };
          });
          return {
            ...previous,
            sections: [...previous.sections, section],
            products: [...previous.products, ...restoredProducts],
            trash,
          };
        }
        if (entry.kind === "product" && entry.product) {
          const product = entry.product;
          const fallbackSectionId =
            previous.sections.find((s) => s.id === product.sectionId)?.id ??
            previous.sections[0]?.id;
          if (!fallbackSectionId) return { ...previous, trash };
          const productId = previous.products.some((p) => p.id === product.id)
            ? makeId("product")
            : product.id;
          return {
            ...previous,
            products: [
              ...previous.products,
              {
                ...product,
                id: productId,
                sectionId: fallbackSectionId,
                archivedAt: null,
              },
            ],
            trash,
          };
        }
        if (entry.kind === "box" && entry.box) {
          const box = entry.box;
          const boxId = previous.boxes.some((b) => b.id === box.id)
            ? makeId("box")
            : box.id;
          return {
            ...previous,
            boxes: [...previous.boxes, { ...box, id: boxId, archivedAt: null }],
            trash,
          };
        }
        return { ...previous, trash };
      });
    },
    [commit],
  );

  const purgeTrash = useCallback(
    (id: string) => {
      commit((previous) => ({
        ...previous,
        trash: previous.trash.filter((item) => item.id !== id),
      }));
    },
    [commit],
  );

  const emptyTrash = useCallback(() => {
    commit((previous) => ({ ...previous, trash: [] }));
  }, [commit]);

  const setTrashRetention = useCallback(
    (value: ApsherRetention) => {
      commit((previous) => ({
        ...previous,
        settings: { ...previous.settings, trashRetention: value },
      }));
    },
    [commit],
  );

  const exportCurrent = useCallback(async () => {
    const result = await exportDataJson(data);
    if (result === "downloads" || result === "shared")
      setAutoStatus(`تم تصدير النسخة الحالية · ${formatDate(now())}`);
    return result;
  }, [data]);

  const exportZip = useCallback(async () => {
    const result = await exportDataZip(data);
    if (result === "downloads" || result === "shared")
      setAutoStatus(`تم إنشاء ZIP كامل · ${formatDate(now())}`);
    return result;
  }, [data]);

  const enableDeviceBackup = useCallback(async () => {
    const selected = await selectDeviceBackupDirectory();
    if (!selected) return false;
    const synced = await persist(data);
    if (synced === true) await flushAppBackupSync();
    setDeviceBackupEnabled(synced === true);
    if (synced) setAutoStatus(`تم تفعيل ملف المزامنة · ${formatDate(now())}`);
    return synced === true;
  }, [data]);

  const importZip = useCallback(async () => {
    const backup = await importDataZip();
    if (!backup) return false;
    await mergeData(backup.data);
    setAutoStatus(
      `تم الاسترداد والدمج · آخر مزامنة في الملف: ${formatDate(backup.lastSyncedAt ?? backup.data.updatedAt)}`,
    );
    return true;
  }, [mergeData]);

  const importAsBox = useCallback(async () => {
    const parsed = await parseImportedProducts();
    if (!parsed) return null;
    const items = parsed.products.map((product) => ({
      id: makeId("box-item"),
      productId: makeId("imported"),
      productName: product.name,
      description: product.description,
      quantity: product.quantity,
      barcodeAliases: product.barcodeAliases,
      status: "available" as const,
      addedAt: now(),
    }));
    const box = {
      id: makeId("box"),
      barcode: makeBarcode("box"),
      name: parsed.boxName,
      description: "استيراد من ملف",
      items,
      createdAt: now(),
      updatedAt: now(),
    };
    const next = normalizeData({ ...data, boxes: [...data.boxes, box] });
    next.updatedAt = now();
    setData(next);
    const externalSynced = await persist(next);
    if (externalSynced === false) setDeviceBackupEnabled(false);
    setAutoStatus(`تم استيراد صندوق · ${formatDate(now())}`);
    return `${box.name} (${items.length} عنصر)`;
  }, [data]);

  const setPin = useCallback(async (value: string | null) => {
    if (Platform.OS === "web") {
      if (value) await AsyncStorage.setItem(PIN_KEY, value);
      else await AsyncStorage.removeItem(PIN_KEY);
    } else if (value) {
      await SecureStore.setItemAsync(PIN_KEY, value);
      await AsyncStorage.removeItem(PIN_KEY);
    } else {
      await SecureStore.deleteItemAsync(PIN_KEY);
      await AsyncStorage.removeItem(PIN_KEY);
    }
    setPinState(value);
  }, []);

  const setBiometric = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(value));
    setBiometricState(value);
  }, []);

  const authenticateBiometric = useCallback(async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "فتح أبشر",
      fallbackLabel: "استخدم الرقم السري",
    });
    return result.success;
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      ready,
      autoStatus,
      deviceBackupEnabled,
      pin,
      biometricEnabled,
      commit,
      replaceData,
      mergeData,
      archiveSection,
      archiveProduct,
      archiveBox,
      removeSection,
      removeProduct,
      removeBox,
      restoreTrash,
      purgeTrash,
      emptyTrash,
      setTrashRetention,
      exportCurrent,
      exportZip,
      enableDeviceBackup,
      importZip,
      importAsBox,
      setPin,
      setBiometric,
      authenticateBiometric,
      pickImage: chooseProductImage,
    }),
    [
      data,
      ready,
      autoStatus,
      deviceBackupEnabled,
      pin,
      biometricEnabled,
      commit,
      replaceData,
      mergeData,
      archiveSection,
      archiveProduct,
      archiveBox,
      removeSection,
      removeProduct,
      removeBox,
      restoreTrash,
      purgeTrash,
      emptyTrash,
      setTrashRetention,
      exportCurrent,
      exportZip,
      enableDeviceBackup,
      importZip,
      importAsBox,
      setPin,
      setBiometric,
      authenticateBiometric,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
