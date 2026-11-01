/** Keeps a reader's custom theme colours readable. The hue they pick is kept; only lightness
 * (and, for page backgrounds, strength) is pulled into a range the app's fixed text colours
 * can sit on. Works in OKLCH, where lightness matches what the eye sees. */

type Oklch = { l: number; c: number; h: number };

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function linearRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

function toOklch(hex: string): Oklch {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Back to hex, lowering chroma until the colour fits in sRGB. */
function toHex(colour: Oklch): string {
  const fits = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let rgb = oklchToLinear(colour);
  if (!fits(rgb)) {
    let lo = 0;
    let hi = colour.c;
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(oklchToLinear({ ...colour, c: mid }))) lo = mid; else hi = mid;
    }
    rgb = oklchToLinear({ ...colour, c: lo });
  }
  return `#${rgb.map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG contrast of white text on this colour. */
function contrastWithWhite(hex: string) {
  const [r, g, b] = linearRgb(hex);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

const ACCENT_MIN_L = 0.42;
const WHITE_TEXT_CONTRAST = 4.5;

/** Buttons, active tabs and badges put white text on the accent, so it must reach 4.5:1 with
 * white; and it must not sink into a dark page, so it never goes near black. */
export function readableAccent(hex: string): string {
  const colour = toOklch(hex);
  if (colour.l >= ACCENT_MIN_L && contrastWithWhite(hex) >= WHITE_TEXT_CONTRAST) return hex.toLowerCase();
  let l = Math.max(colour.l, ACCENT_MIN_L);
  let out = toHex({ ...colour, l });
  while (contrastWithWhite(out) < WHITE_TEXT_CONTRAST && l > ACCENT_MIN_L) {
    l -= 0.005;
    out = toHex({ ...colour, l });
  }
  return out;
}

// Ranges the presets' own backgrounds sit in: light pages near white, dark pages near black,
// both only lightly tinted so white and dark cards still read as cards.
const CANVAS = {
  light: { min: 0.93, max: 1, chroma: 0.03 },
  dark: { min: 0.1, max: 0.22, chroma: 0.06 },
};

/** The page background for one mode: light text sits on it in dark mode, dark text in light. */
export function readableCanvas(hex: string, dark: boolean): string {
  const range = dark ? CANVAS.dark : CANVAS.light;
  const colour = toOklch(hex);
  if (colour.l >= range.min && colour.l <= range.max && colour.c <= range.chroma) return hex.toLowerCase();
  return toHex({
    l: Math.min(range.max, Math.max(range.min, colour.l)),
    c: Math.min(colour.c, range.chroma),
    h: colour.h,
  });
}
