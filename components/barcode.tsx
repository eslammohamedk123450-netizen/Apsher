import Code128Auto from "jsbarcode/src/barcodes/CODE128/CODE128_AUTO";
import { useMemo } from "react";
import { View } from "react-native";

type BarcodeProps = {
  value: string;
  format?: "CODE128";
  height?: number;
  maxWidth?: number;
  singleBarWidth?: number;
  lineColor?: string;
  backgroundColor?: string;
};

type Encoder = {
  valid: () => boolean;
  encode: () => { data: string };
};

export function getCode128Bits(value: string) {
  if (!value) return "";
  try {
    const encoder = new (Code128Auto as unknown as new (
      text: string,
      options: Record<string, unknown>,
    ) => Encoder)(value, {});
    return encoder.valid() ? encoder.encode().data : "";
  } catch {
    return "";
  }
}

export function Barcode({
  value,
  height = 48,
  maxWidth,
  singleBarWidth = 2,
  lineColor = "#000000",
  backgroundColor = "#FFFFFF",
}: BarcodeProps) {
  const bits = useMemo(() => {
    return getCode128Bits(value);
  }, [value]);

  if (!bits) return null;
  const quietModules = 10;
  const totalModules = bits.length + quietModules * 2;
  const moduleWidth = maxWidth
    ? Math.min(singleBarWidth, maxWidth / totalModules)
    : singleBarWidth;
  const quietZoneWidth = quietModules * moduleWidth;
  const runs: { width: number; dark: boolean }[] = [];
  let dark = bits[0] === "1";
  let count = 0;
  for (const bit of bits) {
    const nextDark = bit === "1";
    if (nextDark !== dark) {
      runs.push({ width: count * moduleWidth, dark });
      count = 0;
      dark = nextDark;
    }
    count += 1;
  }
  if (count) runs.push({ width: count * moduleWidth, dark });

  return (
    <View
      accessibilityLabel={`باركود ${value}`}
      style={{
        height,
        width: totalModules * moduleWidth,
        maxWidth,
        flexDirection: "row",
        backgroundColor,
        overflow: "hidden",
      }}
    >
      <View style={{ width: quietZoneWidth, height, backgroundColor }} />
      {runs.map((run, index) => (
        <View
          key={index}
          style={{
            width: run.width,
            height,
            backgroundColor: run.dark ? lineColor : backgroundColor,
          }}
        />
      ))}
      <View style={{ width: quietZoneWidth, height, backgroundColor }} />
    </View>
  );
}
