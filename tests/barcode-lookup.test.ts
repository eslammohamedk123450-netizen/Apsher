import { describe, expect, it } from "vitest";
import {
  findBarcodeMatch,
  findBarcodeMatchFromScan,
  normalizeBarcode,
} from "../lib/barcode-lookup";

describe("barcode lookup", () => {
  const data = {
    products: [
      { id: "p-1", barcode: "ABS-P-ABC-1234" },
      { id: "p-2", barcode: "0012345678905" },
    ],
    boxes: [
      {
        id: "b-1",
        barcode: "ABS-B-BOX-1",
        items: [
          { id: "i-1", barcodeAliases: ["0098765432100", "ABS-P-OLD-1"] },
        ],
      },
    ],
  };

  it("finds a product by its exact generated barcode", () => {
    expect(findBarcodeMatch(data, " abs-p-abc-1234\n")).toEqual({
      type: "product",
      productId: "p-1",
    });
  });

  it("falls back to the Android raw scanner value", () => {
    expect(
      findBarcodeMatchFromScan(data, {
        data: "formatted display value",
        raw: "ABS-P-ABC-1234",
      }),
    ).toEqual({ type: "product", productId: "p-1" });
  });

  it("finds box barcodes", () => {
    expect(findBarcodeMatch(data, "ABS-B-BOX-1")).toEqual({
      type: "box",
      boxId: "b-1",
    });
  });

  it("routes a code kept as an item alias directly to the containing item", () => {
    expect(findBarcodeMatch(data, "ABS-P-OLD-1")).toEqual({
      type: "box-item",
      boxId: "b-1",
      itemId: "i-1",
    });
  });

  it("preserves leading zeroes and normalizes Arabic-Indic digits", () => {
    expect(normalizeBarcode("٠٠١٢٣٤٥٦٧٨٩٠٥")).toBe("0012345678905");
    expect(findBarcodeMatch(data, "٠٠١٢٣٤٥٦٧٨٩٠٥")).toEqual({
      type: "product",
      productId: "p-2",
    });
  });

  it("also recognizes a legacy barcode field on a box item", () => {
    const legacyData = {
      products: [],
      boxes: [
        {
          id: "b-old",
          barcode: "BOX",
          items: [{ id: "i-old", barcode: "ITEM-OLD" }],
        },
      ],
    };
    expect(findBarcodeMatch(legacyData, "ITEM-OLD")).toEqual({
      type: "box-item",
      boxId: "b-old",
      itemId: "i-old",
    });
  });

  it("returns no match for a code absent from all data", () => {
    expect(findBarcodeMatch(data, "not-here")).toBeNull();
  });
});
