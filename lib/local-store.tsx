import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import JSZip from "jszip";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
  imageUri?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsumerRecord = {
  id: string;
  productId: string;
  productSnapshot: Product;
  sectionName: string;
  usageDescription: string;
  consumedAt: string;
  addedAt: string;
};

export type AppData = {
  version: 1;
  sections: Section[];
  products: Product[];
  consumerRecords: ConsumerRecord[];
  updatedAt: string;
};

type AppContextValue = {
  data: AppData;
  ready: boolean;
  autoStatus: string;
  pin: string | null;
  biometricEnabled: boolean;
  commit: (updater: AppData | ((previous: AppData) => AppData)) => Promise<void>;
  exportCurrent: () => Promise<string | null>;
  exportZip: () => Promise<string | null>;
  importZip: () => Promise<boolean>;
  setPin: (value: string | null) => Promise<void>;
  setBiometric: (value: boolean) => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  pickImage: () => Promise<string | null>;
};

const DATA_KEY = "emsir.app.data.v1";
const PIN_KEY = "emsir.app.pin";
const BIOMETRIC_KEY = "emsir.app.biometric";
const META_KEY = "emsir.app.backup.meta";
const now = () => new Date().toISOString();
const stamp = () => now().replace(/[.:]/g, "-");
const documentRoot = () => FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";

export const emptyData = (): AppData => ({
  version: 1,
  sections: [],
  products: [],
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

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function normalizeData(input: Partial<AppData>): AppData {
  return {
    version: 1,
    sections: Array.isArray(input.sections) ? input.sections : [],
    products: Array.isArray(input.products) ? input.products : [],
    consumerRecords: Array.isArray(input.consumerRecords) ? input.consumerRecords : [],
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now(),
  };
}

async function writeAutoBackup(data: AppData) {
  const root = documentRoot();
  if (!root) return null;
  const path = `${root}emsir-auto-backup.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await AsyncStorage.setItem(META_KEY, JSON.stringify({ path, exportedAt: now() }));
  return path;
}

async function persist(data: AppData) {
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
  return writeAutoBackup(data);
}

async function shareFile(path: string, mimeType: string, title: string) {
  if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(path, { mimeType, dialogTitle: title, UTI: mimeType });
  }
}

async function uriToBase64(uri: string) {
  if (uri.startsWith("data:")) return uri.split(",")[1] ?? "";
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function saveBase64Image(path: string, base64: string) {
  const root = documentRoot();
  if (!root) return `data:image/jpeg;base64,${base64}`;
  const safeName = path.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "") || `${makeId("image")}.jpg`;
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
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareFile(path, "application/json", "تصدير بيانات إسمير");
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

  const consumers: ConsumerRecord[] = [];
  for (const record of data.consumerRecords) {
    const snapshot = { ...record.productSnapshot };
    if (snapshot.imageUri) {
      try {
        snapshot.imageUri = await addImage(snapshot.imageUri, `consumer-${record.id}.jpg`);
      } catch {
        snapshot.imageUri = null;
      }
    }
    consumers.push({ ...record, productSnapshot: snapshot });
  }

  zip.file("data.json", JSON.stringify({ ...data, products, consumerRecords: consumers }, null, 2));
  zip.file(
    "README.txt",
    "نسخة احتياطية من تطبيق إسمير\n\nاستورد ملف ZIP من شاشة الإعدادات لاستعادة الأقسام والمنتجات وسجل المستهلك والصور.\n",
  );
  const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const root = documentRoot();
  if (!root) return null;
  const path = `${root}emsir-backup-${stamp()}.zip`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  await shareFile(path, "application/zip", "تصدير نسخة إسمير الكاملة");
  return path;
}

export async function importDataZip() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const base64 = asset.base64?.replace(/^data:.*base64,/, "") ?? (await uriToBase64(asset.uri));
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const dataFile = zip.file("data.json");
  if (!dataFile) throw new Error("ملف ZIP لا يحتوي على data.json");
  const raw = JSON.parse(await dataFile.async("string")) as Partial<AppData>;
  const imported = normalizeData(raw);
  const imageCache: Record<string, string> = {};
  const restoreReference = async (reference?: string | null) => {
    if (!reference || !reference.startsWith("images/")) return reference ?? null;
    if (imageCache[reference]) return imageCache[reference];
    const file = zip.file(reference);
    if (!file) return null;
    const restored = await saveBase64Image(reference, await file.async("base64"));
    imageCache[reference] = restored;
    return restored;
  };
  for (const product of imported.products) product.imageUri = await restoreReference(product.imageUri);
  for (const record of imported.consumerRecords) {
    record.productSnapshot.imageUri = await restoreReference(record.productSnapshot.imageUri);
  }
  return imported;
}

export async function chooseProductImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("اسمح للتطبيق بالوصول إلى الصور لاختيار صورة المنتج");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
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
  return {
    data: rawData ? normalizeData(JSON.parse(rawData)) : emptyData(),
    pin: rawPin,
    biometricEnabled: rawBiometric === "true",
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [pin, setPinState] = useState<string | null>(null);
  const [biometricEnabled, setBiometricState] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoStatus, setAutoStatus] = useState("جاري تجهيز الحفظ المحلي…");

  useEffect(() => {
    loadInitialState()
      .then((state) => {
        setData(state.data);
        setPinState(state.pin);
        setBiometricState(state.biometricEnabled);
        setAutoStatus(state.data.updatedAt ? `آخر نسخة تلقائية ${formatDate(state.data.updatedAt)}` : "لم يتم التصدير بعد");
      })
      .catch(() => setAutoStatus("تعذر قراءة النسخة المحلية"))
      .finally(() => setReady(true));
  }, []);

  const commit = useCallback(async (updater: AppData | ((previous: AppData) => AppData)) => {
    const next = normalizeData(typeof updater === "function" ? updater(data) : updater);
    next.updatedAt = now();
    setData(next);
    setAutoStatus("جاري التصدير التلقائي…");
    try {
      await persist(next);
      setAutoStatus(`تم الحفظ تلقائيًا · ${formatDate(next.updatedAt)}`);
    } catch {
      setAutoStatus("تم حفظ البيانات، تعذر إنشاء ملف التصدير التلقائي");
    }
  }, [data]);

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

  const importZip = useCallback(async () => {
    const imported = await importDataZip();
    if (!imported) return false;
    setData(imported);
    await persist(imported);
    setAutoStatus(`تم استرداد النسخة · ${formatDate(now())}`);
    return true;
  }, []);

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
      promptMessage: "فتح إسمير",
      fallbackLabel: "استخدم الرقم السري",
    });
    return result.success;
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    data,
    ready,
    autoStatus,
    pin,
    biometricEnabled,
    commit,
    exportCurrent,
    exportZip,
    importZip,
    setPin,
    setBiometric,
    authenticateBiometric,
    pickImage: chooseProductImage,
  }), [data, ready, autoStatus, pin, biometricEnabled, commit, exportCurrent, exportZip, importZip, setPin, setBiometric, authenticateBiometric]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
