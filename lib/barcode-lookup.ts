export type BarcodeData = {
  products: Array<{ id: string; barcode: string }>;
  boxes: Array<{
    id: string;
    barcode: string;
    items: Array<{
      id: string;
      barcode?: string;
      barcodeAliases?: string[];
    }>;
  }>;
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
