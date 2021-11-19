import { Vector } from './vector';

export class Circle {

  private static hslToRgb(hue: number, sat: number, light: number): { r: number; b: number; g: number } {
    let t2;
    hue = hue / 60;
    if (light <= 0.5) {
      t2 = light * (sat + 1);
    } else {
      t2 = light + sat - (light * sat);
    }
    const t1 = light * 2 - t2;
    const r = Circle.hueToRgb(t1, t2, hue + 2) * 255;
    const g = Circle.hueToRgb(t1, t2, hue) * 255;
    const b = Circle.hueToRgb(t1, t2, hue - 2) * 255;
    return { r, g, b};
  }

  private static hueToRgb(t1: number, t2: number, hue: number): number {
    if (hue < 0) {
      hue += 6;
    }
    if (hue >= 6) {
      hue -= 6;
    }
    if (hue < 1) {
      return (t2 - t1) * hue + t1;
    }
    if (hue < 3) {
      return t2;
    }
    if (hue < 4) {
      return (t2 - t1) * (4 - hue) + t1;
    }
    return t1;
  }

  constructor(public pos: Vector, public r: number) {
  }

  getColor(step: number): { h: number, s: number, l: number } {
    const h = 365 * Math.abs(Math.sin(this.pos.x * 0.03 + 5));
    const s = 100 * Math.abs(Math.cos(this.r));
    const l = 50;
    return {h, s, l};
  }

  getColorString(step: number): string {
    const {h, s, l} = this.getColor(step);
    const rgb = Circle.hslToRgb(h, s, l);
    return this.toRGBtoHex(rgb);
  }

  toRGBtoHex({r, g, b}: { r: number, g: number, b: number }) {
    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  }

  toHex(val: number): string {
    const result = Math.floor(val % 255).toString(16);
    return result.length > 1 ? result : '0' + result;
  }



}

