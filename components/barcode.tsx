import Code128Auto from "jsbarcode/src/barcodes/CODE128/CODE128_AUTO";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

type BarcodeProps = {
  value: string;
  format?: "CODE128";
  height?: number;
  maxWidth?: number;
  singleBarWidth?: number;
  lineColor?: string;
  backgroundColor?: string;
  /** لون الإطار الخفيف حول الباركود. مرّر null لإخفائه. */
  borderColor?: string | null;
};

type Encoder = {
  valid: () => boolean;
  encode: () => { data: string };
};

/** عدد الوحدات البيضاء الإلزامية (quiet zone) على كل جانب ليكون الباركود قابلًا للمسح. */
const QUIET_MODULES = 10;

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

/**
 * باركود CODE128 حقيقي: أعمدة متجهية (SVG) لا تتشوّه عند التكبير، مع
 * مناطق بيضاء جانبية ومحيط أبيض وإطار خفيف ليقرأه الماسح بدقة عند الطباعة.
 */
export function Barcode({
  value,
  height = 48,
  maxWidth,
  singleBarWidth = 2,
  lineColor = "#111111",
  backgroundColor = "#FFFFFF",
  borderColor = "#D7E0EC",
}: BarcodeProps) {
  const bits = useMemo(() => getCode128Bits(value), [value]);

  const runs = useMemo(() => {
    if (!bits) return [];
    const bars: { x: number; width: number }[] = [];
    let start = -1;
    for (let index = 0; index <= bits.length; index += 1) {
      if (bits[index] === "1" && start < 0) start = index;
      if (bits[index] !== "1" && start >= 0) {
        bars.push({ x: start + QUIET_MODULES, width: index - start });
        start = -1;
      }
    }
    return bars;
  }, [bits]);

  if (!bits) return null;

  const totalModules = bits.length + QUIET_MODULES * 2;
  const intrinsicWidth = totalModules * singleBarWidth;
  const width = maxWidth ? Math.min(maxWidth, intrinsicWidth) : intrinsicWidth;

  return (
    <View
      accessibilityLabel={`باركود ${value}`}
      style={{
        width,
        maxWidth,
        backgroundColor,
        borderRadius: 8,
        borderWidth: borderColor ? 1 : 0,
        borderColor: borderColor ?? "transparent",
        overflow: "hidden",
        paddingHorizontal: 5,
        paddingVertical: 5,
      }}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${totalModules} 100`}
        preserveAspectRatio="none"
      >
        <Rect
          x={0}
          y={0}
          width={totalModules}
          height={100}
          fill={backgroundColor}
        />
        {runs.map((run, index) => (
          <Rect
            key={index}
            x={run.x}
            y={0}
            width={run.width}
            height={100}
            fill={lineColor}
          />
        ))}
      </Svg>
    </View>
  );
}