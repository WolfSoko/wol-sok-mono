const class2Color = [110, 150, 255];
const neutralColor = [255, 255, 255];
const class1Color = [255, 215, 70];

/** Diverging colour scale: class 2 blue at 0, white at 0.5, class 1 yellow at 1. */
export function heatmapColor(activation: number): number[] {
  const [from, to, t] =
    activation < 0.5
      ? [class2Color, neutralColor, activation * 2]
      : [neutralColor, class1Color, activation * 2 - 1];
  return from.map((channel, i) => channel + (to[i] - channel) * t);
}

/** Writes an opaque RGB colour as the pixel at `index` of p5 image pixels. */
export function setPixel(
  pixels: number[] | Uint8ClampedArray,
  index: number,
  [r, g, b]: number[]
): void {
  const i = index * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = 255;
}
