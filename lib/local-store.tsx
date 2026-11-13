import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import JSZip from "jszip";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Section = {
  id: string;
  name: string;
  createdAt: string;
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

export type AppData = {
  version: 2;
  sections: Section[];
  products: Product[];
  boxes: Box[];
  consumerRecords: ConsumerRecord[];
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
  exportCurrent: () => Promise<string | null>;
  exportZip: () => Promise<string | null>;
  enableDeviceBackup: () => Promise<boolean>;
  importZip: () => Promise<boolean>;
  importAsBox: () => Promise<string | null>;
  setPin: (value: string | null) => Promise<void>;
  setBiometric: (value: boolean) => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  pickImage: () => Promise<string | null>;
};

const DATA_KEY = "emsir.app.data.v1";
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
          : makeBarcode("product"),
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
      if (!barcodeAliases.length) barcodeAliases.push(makeBarcode("product"));
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
          : makeBarcode("box"),
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
  return {
    version: 2,
    sections: Array.isArray(input.sections) ? input.sections : [],
    products,
    boxes,
    consumerRecords,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now(),
  };
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
    JSON.stringify(createBackupFile(data, syncedAt), null, 2),
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

async function persist(data: AppData) {
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
  await writeAutoBackup(data);
  const fileUri = await AsyncStorage.getItem(DEVICE_BACKUP_URI_KEY);
  if (fileUri) {
    try {
      await FileSystem.StorageAccessFramework.writeAsStringAsync(
        fileUri,
        JSON.stringify(createBackupFile(data), null, 2),
        {
          encoding: FileSystem.EncodingType.UTF8,
        },
      );
      return true;
    } catch {
      await AsyncStorage.removeItem(DEVICE_BACKUP_URI_KEY);
      return false;
    }
  }
  return null;
}

async function shareFile(path: string, mimeType: string, title: string) {
  if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(path, {
      mimeType,
      dialogTitle: title,
      UTI: mimeType,
    });
  }
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

export async function exportDataJson(data: AppData) {
  const root = documentRoot();
  if (!root) return null;
  const path = `${root}emsir-backup-${stamp()}.json`;
  await FileSystem.writeAsStringAsync(
    path,
    JSON.stringify(createBackupFile(data), null, 2),
    {
      encoding: FileSystem.EncodingType.UTF8,
    },
  );
  await shareFile(path, "application/json", "تصدير بيانات أبشر");
  return path;
}

export async function exportDataZip(data: AppData) {
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

  const exportData = { ...data, products, boxes, consumerRecords: consumers };
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
  const root = documentRoot();
  if (!root) return null;
  const path = `${root}emsir-backup-${stamp()}.zip`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await shareFile(path, "application/zip", "تصدير نسخة أبشر الكاملة");
  return path;
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
  const data = rawParsed ? normalizeData(rawParsed) : emptyData();
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

  const exportCurrent = useCallback(async () => {
    const path = await exportDataJson(data);
    if (path) setAutoStatus(`تم تصدير النسخة الحالية · ${formatDate(now())}`);
    return path;
  }, [data]);

  const exportZip = useCallback(async () => {
    const path = await exportDataZip(data);
    if (path) setAutoStatus(`تم إنشاء ZIP كامل · ${formatDate(now())}`);
    return path;
  }, [data]);

  const enableDeviceBackup = useCallback(async () => {
    const selected = await selectDeviceBackupDirectory();
    if (!selected) return false;
    const synced = await persist(data);
    setDeviceBackupEnabled(synced === true);
    if (synced) setAutoStatus(`تم تفعيل ملف المزامنة · ${formatDate(now())}`);
    return synced === true;
  }, [data]);

  const importZip = useCallback(async () => {
    const backup = await importDataZip();
    if (!backup) return false;
    setData(backup.data);
    const externalSynced = await persist(backup.data);
    if (externalSynced === false) setDeviceBackupEnabled(false);
    setAutoStatus(
      `تم الاسترداد · آخر مزامنة في الملف: ${formatDate(backup.lastSyncedAt ?? backup.data.updatedAt)}`,
    );
    return true;
  }, []);

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
