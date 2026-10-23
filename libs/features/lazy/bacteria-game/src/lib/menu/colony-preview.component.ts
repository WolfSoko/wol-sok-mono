import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { Rgb } from '../arena/arena-theme';
import { mix, rgba } from '../arena/canvas-math';
import { geneLevel, Loadout, MAX_GENE_LEVEL } from '../state/evolution';
import { seeded } from '../state/geometry';
import { WEAPON_COLORS } from './evolution-look';
import { prefersReducedMotion } from './evolution-fx';

/** The preview's size in CSS pixels - drawn sharper on dense screens. */
const SIZE = 320;
/** The colony's radius in the preview. */
const RADIUS = 104;
/** The most bacteria it shows - mitosis bred to the top. */
const MAX_CELLS = 54;
const TOXIC: Rgb = [170, 255, 80];
const GOLD: Rgb = [255, 214, 110];
/** How long a celebration's flash runs through the colony. */
const FLARE_MS = 900;

/** How a loadout makes the colony in the preview look and move. */
export interface ColonyLook {
  /** Bacteria shown - more with mitosis. */
  cells: number;
  /** How fast they swirl - faster with flagella. */
  speed: number;
  /** Length of the toxin spikes in pixels, 0 without toxins. */
  spikes: number;
  spikeCount: number;
  /** The toxins' glow, in pixels of blur. */
  glow: number;
  /** Width of the membrane round the colony, 0 without one. */
  membrane: number;
  /** Length of the flagella tails, 0 without flagella. */
  tail: number;
  /** How strongly the bacteria pulse with energy - metabolism - 0 to 1. */
  pulse: number;
  /** Pulses per second. */
  pulseHz: number;
  /** The colour of the weapon carried, null for none. */
  aura: Rgb | null;
}

/** What the genes and the weapon of a loadout show in the preview. */
export function colonyLook(loadout: Loadout): ColonyLook {
  const level = (id: Parameters<typeof geneLevel>[1]) =>
    geneLevel(loadout, id) / MAX_GENE_LEVEL;
  const mitosis = level('mitosis');
  const toxins = level('toxins');
  const membrane = level('membrane');
  const flagella = level('flagella');
  const metabolism = level('metabolism');
  return {
    cells: Math.round(20 + mitosis * (MAX_CELLS - 20)),
    speed: 0.35 + flagella * 0.9,
    spikes: toxins * 7,
    spikeCount: toxins > 0 ? 5 + Math.round(toxins * 4) : 0,
    glow: toxins * 14,
    membrane: membrane * 7,
    tail: flagella * 18,
    pulse: metabolism,
    pulseHz: 0.6 + metabolism * 2.2,
    aura: loadout.weapon === null ? null : WEAPON_COLORS[loadout.weapon],
  };
}

/** One bacterium of the preview, where it sits in the colony. */
interface PreviewCell {
  /** Distance from the centre, 0 to 1 of the radius, and its angle. */
  r: number;
  a: number;
  size: number;
  phase: number;
  /** How fast it swirls, relative to the others. */
  drift: number;
}

/**
 * The player's colony as they have evolved it, alive on a canvas: the
 * more mitosis the more bacteria, toxins grow glowing spikes, the membrane
 * a translucent ring round the colony, flagella wiggling tails and speed,
 * metabolism a pulse of energy - and the weapon carried glows round it all.
 * One frame only for players who ask for less motion.
 */
@Component({
  selector: 'feat-lazy-bac-game-colony-preview',
  template: `<canvas
    #canvas
    class="canvas"
    role="img"
    [attr.aria-label]="label()"
  ></canvas>`,
  styles: `
    :host {
      display: block;
      aspect-ratio: 1;
    }

    .canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColonyPreviewComponent {
  public readonly loadout = input.required<Loadout>();
  /** The colony's colour. */
  public readonly color = input.required<Rgb>();
  /** What a screen reader hears of it. */
  public readonly label = input('');

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly look = computed(() => colonyLook(this.loadout()));
  private readonly cells: PreviewCell[] = previewCells(7);
  private context: CanvasRenderingContext2D | null = null;
  private frame = 0;
  private startMs = 0;
  /** When the last celebration started, in ms of the animation clock. */
  private flareAtMs = -Infinity;
  private flareColor: Rgb = GOLD;
  private readonly still = prefersReducedMotion();

  public constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.context = this.setUp();
      if (this.context === null || this.still) {
        return;
      }
      const loop = (now: number) => {
        if (this.startMs === 0) {
          this.startMs = now;
        }
        this.draw((now - this.startMs) / 1000);
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    });
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
    // Still, the one frame follows every change.
    effect(() => {
      this.look();
      this.color();
      if (this.still && this.context !== null) {
        this.draw(0);
      }
    });
  }

  /** A flash of light through the colony - for a purchase. */
  public celebrate(color: Rgb): void {
    // Still for players who ask for less motion.
    if (this.still || this.startMs === 0) {
      return;
    }
    this.flareColor = color;
    this.flareAtMs = performance.now() - this.startMs;
  }

  private setUp(): CanvasRenderingContext2D | null {
    const canvas = this.canvas().nativeElement;
    const scale = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = SIZE * scale;
    canvas.height = SIZE * scale;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      // A browser - or a test DOM - without a 2D canvas shows nothing.
    }
    context?.setTransform(scale, 0, 0, scale, 0, 0);
    if (context !== null) {
      this.draw(0);
    }
    return context;
  }

  private draw(t: number): void {
    const cx = this.context;
    if (cx === null) {
      return;
    }
    const look = this.look();
    const color = this.color();
    const center = SIZE / 2;
    const sinceFlare = t * 1000 - this.flareAtMs;
    const flare =
      sinceFlare >= 0 && sinceFlare < FLARE_MS ? 1 - sinceFlare / FLARE_MS : 0;
    cx.clearRect(0, 0, SIZE, SIZE);

    // The dish.
    cx.strokeStyle = 'rgba(255,255,255,0.08)';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(center, center, SIZE / 2 - 4, 0, Math.PI * 2);
    cx.stroke();

    if (look.aura !== null) {
      drawAura(cx, center, look.aura, t);
    }
    if (look.membrane > 0) {
      drawMembrane(cx, center, color, look.membrane, t);
    }
    const swirl = t * look.speed;
    for (const cell of this.cells.slice(0, look.cells)) {
      const angle = cell.a + swirl * cell.drift * 0.35;
      const r = cell.r * RADIUS + Math.sin(t * 1.3 + cell.phase) * 4;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      // Swirling round the centre: the tail points back along the way.
      const heading = angle + Math.PI / 2;
      drawCell(cx, look, color, cell, x, y, heading, t, flare);
    }
    if (flare > 0) {
      const ring = (1 - flare) * RADIUS * 1.5;
      cx.strokeStyle = rgba(this.flareColor, flare);
      cx.lineWidth = 6 * flare;
      cx.beginPath();
      cx.arc(center, center, ring, 0, Math.PI * 2);
      cx.stroke();
    }
  }
}

/** The bacteria of the preview, spread over a disc, the same each visit. */
function previewCells(seed: number): PreviewCell[] {
  const random = seeded(seed);
  return Array.from({ length: MAX_CELLS }, () => ({
    // Square root: evenly over the disc, not crowded in the middle.
    r: Math.sqrt(random()) * 0.88,
    a: random() * Math.PI * 2,
    size: 4.5 + random() * 3.5,
    phase: random() * Math.PI * 2,
    drift: 0.6 + random() * 0.8,
  }));
}

function drawAura(
  cx: CanvasRenderingContext2D,
  center: number,
  aura: Rgb,
  t: number
): void {
  const breath = 0.8 + 0.2 * Math.sin(t * 2.4);
  const glow = cx.createRadialGradient(
    center,
    center,
    RADIUS * 0.2,
    center,
    center,
    RADIUS * 1.45
  );
  glow.addColorStop(0, rgba(aura, 0.28 * breath));
  glow.addColorStop(0.7, rgba(aura, 0.12 * breath));
  glow.addColorStop(1, rgba(aura, 0));
  cx.fillStyle = glow;
  cx.fillRect(0, 0, SIZE, SIZE);
  // Sparks circling the colony.
  cx.fillStyle = rgba(mix(aura, [255, 255, 255], 0.4), 0.9);
  for (let i = 0; i < 10; i++) {
    const angle = t * 0.8 + (i * Math.PI * 2) / 10;
    const r = RADIUS + 18 + Math.sin(t * 3 + i) * 5;
    cx.beginPath();
    cx.arc(
      center + Math.cos(angle) * r,
      center + Math.sin(angle) * r,
      1.6 + Math.sin(t * 5 + i) * 0.8,
      0,
      Math.PI * 2
    );
    cx.fill();
  }
}

function drawMembrane(
  cx: CanvasRenderingContext2D,
  center: number,
  color: Rgb,
  width: number,
  t: number
): void {
  const light = mix(color, [255, 255, 255], 0.55);
  cx.beginPath();
  for (let step = 0; step <= 72; step++) {
    const theta = (step / 72) * Math.PI * 2;
    const r = RADIUS + 12 + Math.sin(theta * 5 + t * 1.2) * 3;
    const x = center + Math.cos(theta) * r;
    const y = center + Math.sin(theta) * r;
    if (step === 0) {
      cx.moveTo(x, y);
    } else {
      cx.lineTo(x, y);
    }
  }
  cx.closePath();
  cx.fillStyle = rgba(light, 0.05 + width * 0.01);
  cx.fill();
  cx.strokeStyle = rgba(light, 0.25 + width * 0.05);
  cx.lineWidth = width;
  cx.stroke();
  cx.strokeStyle = rgba(light, 0.15);
  cx.lineWidth = 1;
  cx.beginPath();
  cx.arc(center, center, RADIUS + 12 - width, 0, Math.PI * 2);
  cx.stroke();
}

function drawCell(
  cx: CanvasRenderingContext2D,
  look: ColonyLook,
  color: Rgb,
  cell: PreviewCell,
  x: number,
  y: number,
  heading: number,
  t: number,
  flare: number
): void {
  const size = cell.size * (1 + flare * 0.35);
  const back = heading + Math.PI;
  if (look.tail > 0) {
    // A tail whipping from side to side behind the bacterium.
    cx.strokeStyle = rgba(mix(color, [255, 255, 255], 0.3), 0.7);
    cx.lineWidth = 1.3;
    cx.beginPath();
    cx.moveTo(x + Math.cos(back) * size, y + Math.sin(back) * size);
    for (let j = 1; j <= 7; j++) {
      const along = size + (j / 7) * look.tail;
      const sway = Math.sin(t * (8 + look.speed * 6) + j * 0.9 + cell.phase);
      const side = sway * (1 + j * 0.5);
      cx.lineTo(
        x + Math.cos(back) * along + Math.cos(heading + Math.PI / 2) * side,
        y + Math.sin(back) * along + Math.sin(heading + Math.PI / 2) * side
      );
    }
    cx.stroke();
  }
  if (look.spikes > 0) {
    cx.save();
    cx.shadowColor = rgba(TOXIC, 0.9);
    cx.shadowBlur = look.glow;
    cx.strokeStyle = rgba(mix(color, TOXIC, 0.6), 0.95);
    cx.lineWidth = 1.4;
    cx.beginPath();
    for (let k = 0; k < look.spikeCount; k++) {
      const a = (k / look.spikeCount) * Math.PI * 2 + t * 0.6 + cell.phase;
      cx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
      cx.lineTo(
        x + Math.cos(a) * (size + look.spikes),
        y + Math.sin(a) * (size + look.spikes)
      );
    }
    cx.stroke();
    cx.restore();
  }
  // The body: a lit, slightly long sphere along the way it goes.
  cx.save();
  cx.translate(x, y);
  cx.rotate(heading);
  const body = cx.createRadialGradient(
    -size * 0.3,
    -size * 0.3,
    size * 0.1,
    0,
    0,
    size * 1.3
  );
  body.addColorStop(0, rgba(mix(color, [255, 255, 255], 0.6)));
  body.addColorStop(0.5, rgba(color));
  body.addColorStop(1, rgba(mix(color, [0, 0, 0], 0.4)));
  cx.fillStyle = body;
  cx.beginPath();
  cx.ellipse(0, 0, size * 1.25, size, 0, 0, Math.PI * 2);
  cx.fill();
  if (look.pulse > 0) {
    const beat =
      (1 + Math.sin(t * look.pulseHz * Math.PI * 2 + cell.phase)) / 2;
    cx.fillStyle = rgba([255, 240, 170], look.pulse * 0.7 * beat);
    cx.beginPath();
    cx.ellipse(0, 0, size * 0.55, size * 0.45, 0, 0, Math.PI * 2);
    cx.fill();
  }
  cx.restore();
}
