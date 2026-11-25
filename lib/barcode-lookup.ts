export type BarcodeData = {
  products: { id: string; barcode: string }[];
  boxes: {
    id: string;
    barcode: string;
    items: {
      id: string;
      barcode?: string;
      barcodeAliases?: string[];
    }[];
  }[];
};

export type BarcodeMatch =
  | { type: "product"; productId: string }
  | { type: "box"; boxId: string }
  | { type: "box-item"; boxId: string; itemId: string };

/** Normalize scanner output without losing significant leading zeroes. */
export function normalizeBarcode(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(
      /[\s\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g,
      "",
    )
    .toUpperCase();
}

/** Resolve a scanned code against every stored barcode location in priority order. */
export function findBarcodeMatch(
  data: BarcodeData,
  value: string,
): BarcodeMatch | null {
  const scanned = normalizeBarcode(value);
  if (!scanned) return null;

  const product = data.products.find(
    (entry) => normalizeBarcode(entry.barcode) === scanned,
  );
  if (product) return { type: "product", productId: product.id };

  const box = data.boxes.find(
    (entry) => normalizeBarcode(entry.barcode) === scanned,
  );
  if (box) return { type: "box", boxId: box.id };

  for (const candidateBox of data.boxes) {
    const item = candidateBox.items.find((candidate) => {
      const codes = [
        ...(candidate.barcodeAliases ?? []),
        candidate.barcode ?? "",
      ];
      return codes.some((code) => normalizeBarcode(code) === scanned);
    });
    if (item)
      return { type: "box-item", boxId: candidateBox.id, itemId: item.id };
  }

  return null;
}

/** Try the displayed and raw native scanner values, in that order. */
export function findBarcodeMatchFromScan(
  data: BarcodeData,
  scan: { data: string; raw?: string },
): BarcodeMatch | null {
  const candidates = [...new Set([scan.data, scan.raw ?? ""].filter(Boolean))];
  for (const value of candidates) {
    const match = findBarcodeMatch(data, value);
    if (match) return match;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* منظومة مزرعتي: قسم (باركود اختياري) → عنصر (باركود تلقائي)          */
/* ------------------------------------------------------------------ */

export type MazraatyBarcodeData = {
  sections: { id: string; barcode?: string }[];
  items: { id: string; sectionId: string; barcode: string }[];
};

export type MazraatyBarcodeMatch =
  | { type: "section"; sectionId: string }
  | { type: "item"; sectionId: string; itemId: string };

/** يبحث عن مطابقة باركود في مزرعتي: القسم أولًا ثم العنصر. */
export function findMazraatyBarcodeMatch(
  data: MazraatyBarcodeData,
  value: string,
): MazraatyBarcodeMatch | null {
  const scanned = normalizeBarcode(value);
  if (!scanned) return null;

  const section = data.sections.find(
    (entry) => entry.barcode && normalizeBarcode(entry.barcode) === scanned,
  );
  if (section) return { type: "section", sectionId: section.id };

  const item = data.items.find(
    (entry) => normalizeBarcode(entry.barcode) === scanned,
  );
  if (item) return { type: "item", sectionId: item.sectionId, itemId: item.id };

  return null;
}

/** يجرّب قيمة الكاميرا الظاهرة والخام بنفس ترتيب التطبيق. */
export function findMazraatyBarcodeMatchFromScan(
  data: MazraatyBarcodeData,
  scan: { data: string; raw?: string },
): MazraatyBarcodeMatch | null {
  const candidates = [...new Set([scan.data, scan.raw ?? ""].filter(Boolean))];
  for (const value of candidates) {
    const match = findMazraatyBarcodeMatch(data, value);
    if (match) return match;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* البحث بالاسم أو الرقم النصّي عند عدم وجود باركود مطابق               */
/* ------------------------------------------------------------------ */

export type BarcodeNameData = {
  products: { id: string; name: string }[];
  boxes: {
    id: string;
    name: string;
    items: { id: string; productName: string }[];
  }[];
};

/** يبحث في أبشر بالاسم: منتج → صندوق → منتج داخل صندوق. */
export function findBarcodeByName(
  data: BarcodeNameData,
  query: string,
): BarcodeMatch | null {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return null;
  const match = (value: string) => value.toLocaleLowerCase().includes(text);

  const product = data.products.find((entry) => match(entry.name ?? ""));
  if (product) return { type: "product", productId: product.id };

  const box = data.boxes.find((entry) => match(entry.name ?? ""));
  if (box) return { type: "box", boxId: box.id };

  for (const candidate of data.boxes) {
    const item = candidate.items.find((entry) => match(entry.productName ?? ""));
    if (item)
      return { type: "box-item", boxId: candidate.id, itemId: item.id };
  }
  return null;
}

export type MazraatyNameData = {
  sections: { id: string; name: string }[];
  items: { id: string; sectionId: string; name: string }[];
};

/** يبحث في مزرعتي بالاسم: قسم ثم عنصر. */
export function findMazraatyByName(
  data: MazraatyNameData,
  query: string,
): MazraatyBarcodeMatch | null {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return null;
  const match = (value: string) => value.toLocaleLowerCase().includes(text);

  const section = data.sections.find((entry) => match(entry.name ?? ""));
  if (section) return { type: "section", sectionId: section.id };

  const item = data.items.find((entry) => match(entry.name ?? ""));
  if (item)
    return { type: "item", sectionId: item.sectionId, itemId: item.id };

  return null;
}
