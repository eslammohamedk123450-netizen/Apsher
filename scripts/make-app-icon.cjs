/* eslint-disable */
// يرسم أيقونة التطبيق بنفس أسلوب كارت المنظومة:
//   خلفية زرقا + مربع أبيض بحواف مدوّرة + رمز (مايك + كاميرا) باللون الأزرق.
// الصيغ: app (كاملة) | background (زرقا فقط) | foreground (المربع والرمز بخلفية شفافة)
// التشغيل: node scripts/make-app-icon.cjs [app|background|foreground]
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const MODE = process.argv[2] || "app";
const SIZE = 1024;
const SS = 2;
const W = SIZE * SS;

const OUT = {
  app: path.join(__dirname, "..", "assets", "images", "app-icon.png"),
  background: path.join(__dirname, "..", "assets", "images", "android-icon-background.png"),
  foreground: path.join(__dirname, "..", "assets", "images", "android-icon-foreground.png"),
}[MODE];

const bgOnly = MODE === "background";
const drawBg = MODE === "app" || MODE === "background";

const BLUE = [47, 120, 201];
const WHITE = [255, 255, 255];
const GLYPH = [47, 120, 201];

const img = new PNG({ width: SIZE, height: SIZE });
const src = new Uint8Array(W * W * 4);

// تحويل إحداثي منطقي (0..1024) إلى المساحة المكبّرة.
const T = (v) => v * SS;
// نصف قطر منطقي.
const R = (v) => v * SS;
// تحويل رمز داخل المربع (تحجيم 0.78 حول المركز).
const GS = 0.78;
const G = (v) => (512 + (v - 512) * GS) * SS;
const GR = (v) => v * GS * SS;

function set(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  src[i] = r;
  src[i + 1] = g;
  src[i + 2] = b;
  src[i + 3] = a;
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let cx = x;
  let cy = y;
  if (x < x0 + r) cx = x0 + r;
  else if (x > x1 - r) cx = x1 - r;
  if (y < y0 + r) cy = y0 + r;
  else if (y > y1 - r) cy = y1 - r;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRing(x, y, cx, cy, ro, ri) {
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  return d2 <= ro * ro && d2 >= ri * ri;
}

// 1) الخلفية الزرقا.
if (drawBg) {
  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      set(x, y, BLUE[0], BLUE[1], BLUE[2], 255);
    }
  }
}

// 2) المربع الأبيض ذو الحواف المدوّرة (نفس شكل كارت المنظومة).
if (!bgOnly) {
  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (inRoundRect(x, y, T(232), T(232), T(792), T(792), R(130))) {
        set(x, y, WHITE[0], WHITE[1], WHITE[2], 255);
      }
    }
  }
}

// 3) رمز المايك + الكاميرا جوه المربع.
if (!bgOnly) {
  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      // جسم المايك (كبسولة)
      if (
        inRoundRect(x, y, G(464), G(320), G(560), G(486), GR(48))
      ) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
        continue;
      }
      // مهد المايك (نصف حلقة)
      if (inRing(x, y, G(512), G(452), GR(92), GR(78)) && y >= G(452)) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
        continue;
      }
      // ساق المايك
      if (inRoundRect(x, y, G(504), G(540), G(520), G(596), GR(8))) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
        continue;
      }
      // قاعدة المايك
      if (inRoundRect(x, y, G(456), G(592), G(568), G(610), GR(9))) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
        continue;
      }

      // عدسة الكاميرا (حلقة بيضاء فوق الجسم)
      if (inRing(x, y, G(512), G(712), GR(42), GR(26))) {
        set(x, y, WHITE[0], WHITE[1], WHITE[2], 255);
        continue;
      }
      // لمبة الكاميرا
      if (inCircle(x, y, G(594), G(684), GR(9))) {
        set(x, y, WHITE[0], WHITE[1], WHITE[2], 255);
        continue;
      }
      // نتوء الكاميرا العلوي
      if (inRoundRect(x, y, G(474), G(636), G(550), G(664), GR(12))) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
        continue;
      }
      // جسم الكاميرا
      if (inRoundRect(x, y, G(396), G(656), G(628), G(764), GR(26))) {
        set(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
      }
    }
  }
}

// 4) تصغير (downsample) للتنعيم.
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += src[i];
        g += src[i + 1];
        b += src[i + 2];
        a += src[i + 3];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    img.data[o] = Math.round(r / n);
    img.data[o + 1] = Math.round(g / n);
    img.data[o + 2] = Math.round(b / n);
    img.data[o + 3] = Math.round(a / n);
  }
}

fs.writeFileSync(OUT, PNG.sync.write(img));
console.log("wrote", OUT, MODE, SIZE + "x" + SIZE);