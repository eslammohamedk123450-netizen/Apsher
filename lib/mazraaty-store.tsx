import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { barcodeFromId, makeId, syncAppBackupFile } from "@/lib/local-store";

/**
 * طبقة بيانات منظومة «مزرعتي».
 *
 * مستقلة تمامًا عن بيانات «أبشر»: لها مفاتيح تخزين خاصة بها (`mazraaty.*`)
 * ولا تقرأ ولا تكتب أي شيء في مفاتيح `emsir.*`.
 *
 * البنية: قسم (Section) → عنصر (Item) → ملاحظات (Notes)
 * مع دعم الأرشفة والمحذوفات (سلة مهملات) لكل شيء.
 */

export type MazraatyRetention = "24h" | "7d" | "30d" | "never";

export type MazraatySection = {
  id: string;
  name: string;
  imageUri?: string | null;
  /** باركود اختياري للقسم */
  barcode?: string;
  createdAt: string;
  archivedAt?: string | null;
};

export type MazraatyItem = {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  imageUri?: string | null;
  /** باركود تلقائي للعنصر */
  barcode: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type MazraatyNoteKind = "text" | "image" | "voice";

export type MazraatyNoteChange =
  | "edit-text"
  | "replace-image"
  | "remove-image"
  | "replace-audio"
  | "remove-audio";

/** لقطة لحالة الملاحظة قبل التعديل، لعرضها في سجل التعديلات. */
export type MazraatyNoteRevision = {
  at: string;
  change: MazraatyNoteChange;
  kind: MazraatyNoteKind;
  text?: string;
  imageUri?: string | null;
  audioUri?: string | null;
  durationMs?: number;
};

export type MazraatyNote = {
  id: string;
  itemId: string;
  kind: MazraatyNoteKind;
  text?: string;
  imageUri?: string | null;
  audioUri?: string | null;
  /** مدة التسجيل الصوتي بالميلي ثانية */
  durationMs?: number;
  createdAt: string;
  archivedAt?: string | null;
  /** وقت آخر تعديل (نص/صورة/صوت). */
  editedAt?: string | null;
  /** سجل حالات الملاحظة السابقة، الأحدث في النهاية. */
  history?: MazraatyNoteRevision[];
};

export type MazraatyTrashKind = "section" | "item" | "note";

export type MazraatyTrashEntry = {
  id: string;
  kind: MazraatyTrashKind;
  title: string;
  imageUri?: string | null;
  deletedAt: string;
  /** لقطة كاملة للاستعادة */
  section?: MazraatySection;
  items?: MazraatyItem[];
  notes?: MazraatyNote[];
  item?: MazraatyItem;
  note?: MazraatyNote;
};

export type MazraatySettings = {
  trashRetention: MazraatyRetention;
};

export type MazraatyData = {
  version: 2;
  sections: MazraatySection[];
  items: MazraatyItem[];
  notes: MazraatyNote[];
  trash: MazraatyTrashEntry[];
  settings: MazraatySettings;
  updatedAt: string;
};

export const DEFAULT_SETTINGS: MazraatySettings = { trashRetention: "7d" };

export const RETENTION_OPTIONS: {
  value: MazraatyRetention;
  label: string;
}[] = [
  { value: "24h", label: "كل 24 ساعة" },
  { value: "7d", label: "كل 7 أيام" },
  { value: "30d", label: "كل 30 يومًا" },
  { value: "never", label: "أبدًا (لا تحذف تلقائيًا)" },
];

export const retentionMs = (value: MazraatyRetention): number | null => {
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

type MazraatyContextValue = {
  data: MazraatyData;
  ready: boolean;
  addSection: (input: {
    name: string;
    imageUri?: string | null;
    barcode?: string;
  }) => MazraatySection;
  updateSection: (
    id: string,
    patch: Partial<Pick<MazraatySection, "name" | "imageUri" | "barcode">>,
  ) => void;
  removeSection: (id: string) => void;
  archiveSection: (id: string, archived: boolean) => void;
  addItem: (input: {
    sectionId: string;
    name: string;
    description?: string;
    imageUri?: string | null;
  }) => MazraatyItem;
  updateItem: (
    id: string,
    patch: Partial<
      Pick<MazraatyItem, "name" | "description" | "imageUri" | "barcode">
    >,
  ) => void;
  removeItem: (id: string) => void;
  archiveItem: (id: string, archived: boolean) => void;
  addNote: (input: {
    itemId: string;
    kind: MazraatyNoteKind;
    text?: string;
    imageUri?: string | null;
    audioUri?: string | null;
    durationMs?: number;
  }) => MazraatyNote;
  updateNote: (
    id: string,
    patch: Partial<
      Pick<
        MazraatyNote,
        "text" | "imageUri" | "audioUri" | "durationMs" | "kind"
      >
    >,
    change: MazraatyNoteChange,
  ) => void;
  removeNote: (id: string) => void;
  archiveNote: (id: string, archived: boolean) => void;
  restoreTrash: (id: string) => void;
  purgeTrash: (id: string) => void;
  emptyTrash: () => void;
  setTrashRetention: (value: MazraatyRetention) => void;
  replaceAll: (next: Partial<MazraatyData>) => void;
  mergeAll: (incoming: Partial<MazraatyData>) => void;
  chooseImage: () => Promise<string | null>;
  saveAudio: (uri: string) => Promise<string | null>;
};

const DATA_KEY = "mazraaty.app.data.v1";

const now = () => new Date().toISOString();

export const makeMazraatyBarcode = () =>
  `MZ-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

export const emptyMazraatyData = (): MazraatyData => ({
  version: 2,
  sections: [],
  items: [],
  notes: [],
  trash: [],
  settings: { ...DEFAULT_SETTINGS },
  updatedAt: now(),
});

/** صيغة وقت قصيرة للملاحظات على طريقة الدردشة. */
export const formatNoteTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

/** صيغة التاريخ الكامل لعنوان اليوم في سجل الملاحظات. */
export const formatNoteDay = (value: string) => {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const formatDuration = (ms?: number) => {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const formatDateTime = (value: string) => {
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

function normalizeData(input: Partial<MazraatyData>): MazraatyData {
  const sections = (Array.isArray(input.sections) ? input.sections : []).map(
    (s) => ({
      id: typeof s?.id === "string" && s.id ? s.id : makeId("mz-section"),
      name: typeof s?.name === "string" ? s.name : "قسم",
      imageUri: s?.imageUri ?? null,
      barcode:
        typeof s?.barcode === "string" && s.barcode.trim()
          ? s.barcode.trim()
          : undefined,
      createdAt: typeof s?.createdAt === "string" ? s.createdAt : now(),
      archivedAt: s?.archivedAt ?? null,
    }),
  );
  const sectionIds = new Set(sections.map((s) => s.id));
  const items = (Array.isArray(input.items) ? input.items : [])
    .map((i) => {
      const id = typeof i?.id === "string" && i.id ? i.id : makeId("mz-item");
      return {
        id,
        sectionId: i?.sectionId ?? "",
        name: typeof i?.name === "string" ? i.name : "عنصر",
        description: typeof i?.description === "string" ? i.description : "",
        imageUri: i?.imageUri ?? null,
        barcode:
          typeof i?.barcode === "string" && i.barcode.trim()
            ? i.barcode.trim()
            : barcodeFromId("MZ", id),
        createdAt: typeof i?.createdAt === "string" ? i.createdAt : now(),
        updatedAt: typeof i?.updatedAt === "string" ? i.updatedAt : now(),
        archivedAt: i?.archivedAt ?? null,
      };
    })
    .filter((i) => sectionIds.has(i.sectionId));
  const itemIds = new Set(items.map((i) => i.id));
  const notes = (Array.isArray(input.notes) ? input.notes : [])
    .map((n) => ({
      id: typeof n?.id === "string" && n.id ? n.id : makeId("mz-note"),
      itemId: n?.itemId ?? "",
      kind:
        n?.kind === "image" || n?.kind === "voice"
          ? n.kind
          : ("text" as MazraatyNoteKind),
      text: typeof n?.text === "string" ? n.text : undefined,
      imageUri: n?.imageUri ?? null,
      audioUri: n?.audioUri ?? null,
      durationMs: Number.isFinite(Number(n?.durationMs))
        ? Number(n?.durationMs)
        : undefined,
      createdAt: typeof n?.createdAt === "string" ? n.createdAt : now(),
      archivedAt: n?.archivedAt ?? null,
      editedAt: typeof n?.editedAt === "string" ? n.editedAt : null,
      history: (Array.isArray(n?.history) ? n.history : []).map((r) => ({
        at: typeof r?.at === "string" ? r.at : now(),
        change:
          r?.change === "edit-text" ||
          r?.change === "replace-image" ||
          r?.change === "remove-image" ||
          r?.change === "replace-audio" ||
          r?.change === "remove-audio"
            ? r.change
            : ("edit-text" as MazraatyNoteChange),
        kind:
          r?.kind === "image" || r?.kind === "voice"
            ? r.kind
            : ("text" as MazraatyNoteKind),
        text: typeof r?.text === "string" ? r.text : undefined,
        imageUri: r?.imageUri ?? null,
        audioUri: r?.audioUri ?? null,
        durationMs: Number.isFinite(Number(r?.durationMs))
          ? Number(r?.durationMs)
          : undefined,
      })),
    }))
    .filter((n) => itemIds.has(n.itemId));
  const trash = (Array.isArray(input.trash) ? input.trash : []).map((t) => ({
    id: typeof t?.id === "string" && t.id ? t.id : makeId("mz-trash"),
    kind:
      t?.kind === "item" || t?.kind === "note"
        ? t.kind
        : ("section" as MazraatyTrashKind),
    title: typeof t?.title === "string" ? t.title : "",
    imageUri: t?.imageUri ?? null,
    deletedAt: typeof t?.deletedAt === "string" ? t.deletedAt : now(),
    section: t?.section,
    items: Array.isArray(t?.items) ? t.items : undefined,
    notes: Array.isArray(t?.notes) ? t.notes : undefined,
    item: t?.item,
    note: t?.note,
  }));
  const retention =
    input.settings?.trashRetention === "24h" ||
    input.settings?.trashRetention === "30d" ||
    input.settings?.trashRetention === "never"
      ? input.settings.trashRetention
      : input.settings?.trashRetention === "7d"
        ? "7d"
        : DEFAULT_SETTINGS.trashRetention;
  return {
    version: 2,
    sections,
    items,
    notes,
    trash,
    settings: { trashRetention: retention },
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now(),
  };
}

function purgeExpired(data: MazraatyData): MazraatyData {
  const window = retentionMs(data.settings.trashRetention);
  if (window === null) return data;
  const cutoff = Date.now() - window;
  const trash = data.trash.filter(
    (entry) => new Date(entry.deletedAt).getTime() >= cutoff,
  );
  return trash.length === data.trash.length ? data : { ...data, trash };
}

/**
 * دمج نسخة مستوردة مع بيانات مزرعتي الحالية:
 * - الأقسام تتطابق بالاسم، فيُضاف محتواها للقسم الموجود أو يُنشأ قسم جديد.
 * - العناصر تتبع قسمها بعد إعادة الربط، والملاحظات تتبع عناصرها.
 * - لا تتكرر العناصر بنفس المعرّف.
 */
function mergeMazraatyData(
  current: MazraatyData,
  incoming: Partial<MazraatyData>,
): MazraatyData {
  const source = normalizeData(incoming);
  const next: MazraatyData = {
    ...current,
    sections: [...current.sections],
    items: [...current.items],
    notes: [...current.notes],
    trash: [...current.trash],
  };

  const sectionByName = new Map<string, MazraatySection>();
  for (const section of next.sections)
    sectionByName.set(section.name.trim(), section);

  const sectionIdMap = new Map<string, string>();
  for (const section of source.sections) {
    const key = section.name.trim();
    const existing = key ? sectionByName.get(key) : undefined;
    if (existing) {
      const patch: Partial<MazraatySection> = {};
      if (!existing.imageUri && section.imageUri) patch.imageUri = section.imageUri;
      if (!existing.barcode && section.barcode) patch.barcode = section.barcode;
      if (Object.keys(patch).length) {
        const merged = { ...existing, ...patch };
        const at = next.sections.indexOf(existing);
        if (at >= 0) next.sections[at] = merged;
        sectionByName.set(key, merged);
      }
      sectionIdMap.set(section.id, existing.id);
    } else {
      const id = next.sections.some((s) => s.id === section.id)
        ? makeId("mz-section")
        : section.id;
      const created = { ...section, id };
      next.sections.push(created);
      sectionIdMap.set(section.id, id);
      if (key) sectionByName.set(key, created);
    }
  }

  const itemIds = new Set(next.items.map((item) => item.id));
  const itemIdMap = new Map<string, string>();
  for (const item of source.items) {
    const sectionId = sectionIdMap.get(item.sectionId) ?? item.sectionId;
    if (!next.sections.some((s) => s.id === sectionId)) continue;
    const id = itemIds.has(item.id) ? makeId("mz-item") : item.id;
    itemIds.add(id);
    itemIdMap.set(item.id, id);
    next.items.push({ ...item, id, sectionId });
  }

  const noteIds = new Set(next.notes.map((note) => note.id));
  for (const note of source.notes) {
    const itemId = itemIdMap.get(note.itemId) ?? note.itemId;
    if (!next.items.some((item) => item.id === itemId)) continue;
    const id = noteIds.has(note.id) ? makeId("mz-note") : note.id;
    noteIds.add(id);
    next.notes.push({ ...note, id, itemId });
  }

  for (const entry of source.trash) {
    if (next.trash.some((t) => t.id === entry.id)) continue;
    next.trash.push(entry);
  }

  return next;
}

async function loadData(): Promise<MazraatyData> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    if (!raw) return emptyMazraatyData();
    return purgeExpired(normalizeData(JSON.parse(raw) as Partial<MazraatyData>));
  } catch {
    return emptyMazraatyData();
  }
}

/** يدمج نسخة مزرعتي مستوردة داخل التخزين المحلي دون استبدال الموجود. */
export async function mergeMazraatyIntoStorage(
  payload: Partial<MazraatyData>,
): Promise<MazraatyData> {
  const current = await loadData();
  const next = mergeMazraatyData(current, payload);
  next.updatedAt = now();
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(next));
  await syncAppBackupFile();
  return next;
}

/** يختار صورة مربعة (1:1) ويحفظها بشكل دائم. */
export async function chooseMazraatyImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("اسمح للتطبيق بالوصول إلى الصور لاختيار صورة");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const source = result.assets[0].uri;
  if (Platform.OS === "web") return source;
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  if (!root) return source;
  const destination = `${root}${makeId("mazraaty-photo")}.jpg`;
  await FileSystem.copyAsync({ from: source, to: destination });
  return destination;
}

/** يحوّل تسجيلاً صوتيًا مؤقتًا إلى تخزين دائم. */
export async function persistMazraatyAudio(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    if (!root) return uri;
    const destination = `${root}${makeId("mazraaty-voice")}.m4a`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return null;
  }
}

export function MazraatyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MazraatyData>(emptyMazraatyData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadData()
      .then(setData)
      .finally(() => setReady(true));
  }, []);

  const commit = useCallback(
    (updater: (previous: MazraatyData) => MazraatyData) => {
      setData((previous) => {
        const next = updater(previous);
        next.updatedAt = now();
        void AsyncStorage.setItem(DATA_KEY, JSON.stringify(next)).catch(
          () => {},
        );
        // تحديث النسخة التلقائية للتطبيق بعد كل تغيير في مزرعتي.
        void syncAppBackupFile();
        return next;
      });
    },
    [],
  );

  const addSection = useCallback<MazraatyContextValue["addSection"]>(
    (input) => {
      const section: MazraatySection = {
        id: makeId("mz-section"),
        name: input.name.trim(),
        imageUri: input.imageUri ?? null,
        barcode: input.barcode?.trim() || undefined,
        createdAt: now(),
        archivedAt: null,
      };
      commit((previous) => ({
        ...previous,
        sections: [...previous.sections, section],
      }));
      return section;
    },
    [commit],
  );

  const updateSection = useCallback<MazraatyContextValue["updateSection"]>(
    (id, patch) => {
      commit((previous) => ({
        ...previous,
        sections: previous.sections.map((s) =>
          s.id === id
            ? {
                ...s,
                ...patch,
                name: patch.name !== undefined ? patch.name.trim() : s.name,
                barcode:
                  patch.barcode !== undefined
                    ? patch.barcode.trim() || undefined
                    : s.barcode,
              }
            : s,
        ),
      }));
    },
    [commit],
  );

  const archiveSection = useCallback<MazraatyContextValue["archiveSection"]>(
    (id, archived) => {
      commit((previous) => ({
        ...previous,
        sections: previous.sections.map((s) =>
          s.id === id ? { ...s, archivedAt: archived ? now() : null } : s,
        ),
      }));
    },
    [commit],
  );

  const removeSection = useCallback<MazraatyContextValue["removeSection"]>(
    (id) => {
      commit((previous) => {
        const section = previous.sections.find((s) => s.id === id);
        if (!section) return previous;
        const items = previous.items.filter((i) => i.sectionId === id);
        const itemIds = new Set(items.map((i) => i.id));
        const notes = previous.notes.filter((n) => itemIds.has(n.itemId));
        const entry: MazraatyTrashEntry = {
          id: makeId("mz-trash"),
          kind: "section",
          title: section.name,
          imageUri: section.imageUri ?? null,
          deletedAt: now(),
          section,
          items,
          notes,
        };
        return {
          ...previous,
          sections: previous.sections.filter((s) => s.id !== id),
          items: previous.items.filter((i) => i.sectionId !== id),
          notes: previous.notes.filter((n) => !itemIds.has(n.itemId)),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const addItem = useCallback<MazraatyContextValue["addItem"]>(
    (input) => {
      const item: MazraatyItem = {
        id: makeId("mz-item"),
        sectionId: input.sectionId,
        name: input.name.trim(),
        description: input.description?.trim() || "",
        imageUri: input.imageUri ?? null,
        barcode: makeMazraatyBarcode(),
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      commit((previous) => ({ ...previous, items: [...previous.items, item] }));
      return item;
    },
    [commit],
  );

  const updateItem = useCallback<MazraatyContextValue["updateItem"]>(
    (id, patch) => {
      commit((previous) => ({
        ...previous,
        items: previous.items.map((i) =>
          i.id === id
            ? {
                ...i,
                ...patch,
                name: patch.name !== undefined ? patch.name.trim() : i.name,
                description:
                  patch.description !== undefined
                    ? patch.description.trim()
                    : i.description,
                barcode:
                  patch.barcode !== undefined
                    ? patch.barcode.trim() || i.barcode
                    : i.barcode,
                updatedAt: now(),
              }
            : i,
        ),
      }));
    },
    [commit],
  );

  const archiveItem = useCallback<MazraatyContextValue["archiveItem"]>(
    (id, archived) => {
      commit((previous) => ({
        ...previous,
        items: previous.items.map((i) =>
          i.id === id
            ? { ...i, archivedAt: archived ? now() : null, updatedAt: now() }
            : i,
        ),
      }));
    },
    [commit],
  );

  const removeItem = useCallback<MazraatyContextValue["removeItem"]>(
    (id) => {
      commit((previous) => {
        const item = previous.items.find((i) => i.id === id);
        if (!item) return previous;
        const notes = previous.notes.filter((n) => n.itemId === id);
        const entry: MazraatyTrashEntry = {
          id: makeId("mz-trash"),
          kind: "item",
          title: item.name,
          imageUri: item.imageUri ?? null,
          deletedAt: now(),
          item,
          notes,
        };
        return {
          ...previous,
          items: previous.items.filter((i) => i.id !== id),
          notes: previous.notes.filter((n) => n.itemId !== id),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const addNote = useCallback<MazraatyContextValue["addNote"]>(
    (input) => {
      const note: MazraatyNote = {
        id: makeId("mz-note"),
        itemId: input.itemId,
        kind: input.kind,
        text: input.text?.trim() || undefined,
        imageUri: input.imageUri ?? null,
        audioUri: input.audioUri ?? null,
        durationMs: input.durationMs,
        createdAt: now(),
        archivedAt: null,
      };
      commit((previous) => ({
        ...previous,
        notes: [...previous.notes, note],
        items: previous.items.map((i) =>
          i.id === input.itemId ? { ...i, updatedAt: now() } : i,
        ),
      }));
      return note;
    },
    [commit],
  );

  const updateNote = useCallback<MazraatyContextValue["updateNote"]>(
    (id, patch, change) => {
      commit((previous) => {
        const target = previous.notes.find((n) => n.id === id);
        if (!target) return previous;
        const revision: MazraatyNoteRevision = {
          at: now(),
          change,
          kind: target.kind,
          text: target.text,
          imageUri: target.imageUri ?? null,
          audioUri: target.audioUri ?? null,
          durationMs: target.durationMs,
        };
        return {
          ...previous,
          items: previous.items.map((i) =>
            i.id === target.itemId ? { ...i, updatedAt: now() } : i,
          ),
          notes: previous.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...patch,
                  text:
                    patch.text !== undefined
                      ? patch.text.trim() || n.text
                      : n.text,
                  editedAt: now(),
                  history: [...(n.history ?? []), revision],
                }
              : n,
          ),
        };
      });
    },
    [commit],
  );

  const archiveNote = useCallback<MazraatyContextValue["archiveNote"]>(
    (id, archived) => {
      commit((previous) => ({
        ...previous,
        notes: previous.notes.map((n) =>
          n.id === id ? { ...n, archivedAt: archived ? now() : null } : n,
        ),
      }));
    },
    [commit],
  );

  const removeNote = useCallback<MazraatyContextValue["removeNote"]>(
    (id) => {
      commit((previous) => {
        const note = previous.notes.find((n) => n.id === id);
        if (!note) return previous;
        const entry: MazraatyTrashEntry = {
          id: makeId("mz-trash"),
          kind: "note",
          title:
            note.kind === "text"
              ? note.text ?? "ملاحظة"
              : note.kind === "image"
                ? "صورة"
                : "تسجيل صوتي",
          imageUri: note.imageUri ?? null,
          deletedAt: now(),
          note,
        };
        return {
          ...previous,
          notes: previous.notes.filter((n) => n.id !== id),
          trash: [entry, ...previous.trash],
        };
      });
    },
    [commit],
  );

  const restoreTrash = useCallback<MazraatyContextValue["restoreTrash"]>(
    (id) => {
      commit((previous) => {
        const entry = previous.trash.find((t) => t.id === id);
        if (!entry) return previous;
        const next: MazraatyData = {
          ...previous,
          trash: previous.trash.filter((t) => t.id !== id),
        };
        if (entry.kind === "section" && entry.section) {
          const sectionIds = new Set(next.sections.map((s) => s.id));
          if (!sectionIds.has(entry.section.id))
            next.sections = [...next.sections, entry.section];
          const itemIds = new Set(next.items.map((i) => i.id));
          next.items = [
            ...next.items,
            ...(entry.items ?? []).filter((i) => !itemIds.has(i.id)),
          ];
          const noteIds = new Set(next.notes.map((n) => n.id));
          next.notes = [
            ...next.notes,
            ...(entry.notes ?? []).filter((n) => !noteIds.has(n.id)),
          ];
        } else if (entry.kind === "item" && entry.item) {
          const itemIds = new Set(next.items.map((i) => i.id));
          if (!itemIds.has(entry.item.id))
            next.items = [...next.items, entry.item];
          const noteIds = new Set(next.notes.map((n) => n.id));
          next.notes = [
            ...next.notes,
            ...(entry.notes ?? []).filter((n) => !noteIds.has(n.id)),
          ];
        } else if (entry.kind === "note" && entry.note) {
          const noteIds = new Set(next.notes.map((n) => n.id));
          if (!noteIds.has(entry.note.id))
            next.notes = [...next.notes, entry.note];
        }
        return next;
      });
    },
    [commit],
  );

  const purgeTrash = useCallback<MazraatyContextValue["purgeTrash"]>(
    (id) => {
      commit((previous) => ({
        ...previous,
        trash: previous.trash.filter((t) => t.id !== id),
      }));
    },
    [commit],
  );

  const emptyTrash = useCallback(() => {
    commit((previous) => ({ ...previous, trash: [] }));
  }, [commit]);

  const setTrashRetention = useCallback<
    MazraatyContextValue["setTrashRetention"]
  >(
    (value) => {
      commit((previous) =>
        purgeExpired({
          ...previous,
          settings: { ...previous.settings, trashRetention: value },
        }),
      );
    },
    [commit],
  );

  const replaceAll = useCallback<MazraatyContextValue["replaceAll"]>(
    (next) => {
      const normalized = normalizeData(next);
      setData(normalized);
      void AsyncStorage.setItem(DATA_KEY, JSON.stringify(normalized)).catch(
        () => {},
      );
      void syncAppBackupFile();
    },
    [],
  );

  const mergeAll = useCallback<MazraatyContextValue["mergeAll"]>(
    (incoming) => {
      commit((previous) => mergeMazraatyData(previous, incoming));
    },
    [commit],
  );

  const value = useMemo<MazraatyContextValue>(
    () => ({
      data,
      ready,
      addSection,
      updateSection,
      removeSection,
      archiveSection,
      addItem,
      updateItem,
      removeItem,
      archiveItem,
      addNote,
      updateNote,
      removeNote,
      archiveNote,
      restoreTrash,
      purgeTrash,
      emptyTrash,
      setTrashRetention,
      replaceAll,
      mergeAll,
      chooseImage: chooseMazraatyImage,
      saveAudio: persistMazraatyAudio,
    }),
    [
      data,
      ready,
      addSection,
      updateSection,
      removeSection,
      archiveSection,
      addItem,
      updateItem,
      removeItem,
      archiveItem,
      addNote,
      updateNote,
      removeNote,
      archiveNote,
      restoreTrash,
      purgeTrash,
      emptyTrash,
      setTrashRetention,
      replaceAll,
      mergeAll,
    ],
  );

  return (
    <MazraatyContext.Provider value={value}>
      {children}
    </MazraatyContext.Provider>
  );
}

const MazraatyContext = createContext<MazraatyContextValue | null>(null);

export function useMazraaty() {
  const value = useContext(MazraatyContext);
  if (!value) throw new Error("useMazraaty must be used inside MazraatyProvider");
  return value;
}
