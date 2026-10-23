import type { ScreenResolution } from '../state/arena-size';
import type { ActiveEffect, WeaponFire, WeaponId } from '../state/evolution';
import { clamp } from '../state/geometry';
import { Rgb, WEAPON_COLORS } from './arena-theme';
import { hash, lerp, smoothstep } from './canvas-math';

/**
 * The weapons in the arena: what each looks like as it is fired and while
 * it acts, worked out once per frame for both painters - which then only
 * turn the marks into draw calls, so the WebGL and the canvas arena look
 * alike.
 *
 * Everything here is for the eye only. The particles fly on a random
 * number generator of their own and the clock of the frames, never on the
 * engine's seeded one, so the war plays the same with or without them.
 */

type Color = [number, number, number];

/** What a mark is drawn as. */
export type MarkKind = 'glow' | 'ellipse' | 'ring' | 'hex' | 'field';

/** One shape of a weapon's effect, in arena cells. */
export interface WeaponMark {
  kind: MarkKind;
  x: number;
  y: number;
  /**
   * glow, ring, hex, field: the radius. ellipse: half its length, along
   * `angle`.
   */
  radius: number;
  /** ellipse: half its width. ring and hex: the line width - 0 fills a hex. */
  size: number;
  /** Radians the shape is turned by. */
  angle: number;
  color: Color;
  /** ellipse: the colour at its tip. field: the second colour of its pattern. */
  color2: Color;
  /** 0 to 1. */
  alpha: number;
  /** field: whose pattern it is. */
  weapon: WeaponId;
  /** field: how far it has spread or unfurled, 0 to 1. */
  growth: number;
  /** field: the clock its pattern churns with, in seconds. */
  timeSec: number;
}

/**
 * The marks of one layer, reused from frame to frame: a frame with the
 * same number of marks allocates nothing.
 */
export class MarkLayer {
  private readonly marks: WeaponMark[] = [];
  public count = 0;

  public clear(): void {
    this.count = 0;
  }

  public at(index: number): WeaponMark {
    return this.marks[index];
  }

  /** A mark with its colours and nothing turned - the caller sets the rest. */
  public add(
    kind: MarkKind,
    x: number,
    y: number,
    radius: number,
    color: Rgb,
    alpha: number
  ): WeaponMark {
    let mark = this.marks[this.count];
    if (mark === undefined) {
      mark = {
        kind,
        x,
        y,
        radius,
        size: 0,
        angle: 0,
        color: [0, 0, 0],
        color2: [0, 0, 0],
        alpha,
        weapon: 'toxin-bomb',
        growth: 1,
        timeSec: 0,
      };
      this.marks.push(mark);
    }
    this.count++;
    mark.kind = kind;
    mark.x = x;
    mark.y = y;
    mark.radius = radius;
    mark.size = 0;
    mark.angle = 0;
    copyColor(mark.color, color);
    copyColor(mark.color2, color);
    mark.alpha = clamp(alpha, 0, 1);
    mark.growth = 1;
    mark.timeSec = 0;
    return mark;
  }

  /** The marks of a kind, for the specs. */
  public ofKind(kind: MarkKind): WeaponMark[] {
    return this.marks.slice(0, this.count).filter((mark) => mark.kind === kind);
  }
}

/** How a weapon's effect shades the bacteria of a colony. */
export type TintMode = 'toxin' | 'cryo' | 'shield' | 'bloom';

/** The order the WebGL painter numbers the tints in. */
export const TINT_MODES: readonly TintMode[] = [
  'toxin',
  'cryo',
  'shield',
  'bloom',
];

/** A weapon's effect on the look of the colonies in its circle. */
export interface ColonyTint {
  mode: TintMode;
  x: number;
  y: number;
  /** Cells - a shield's covers its whole colony. */
  radius: number;
  /** 0 to 1, with the effect's fade. */
  strength: number;
  /** The colour of the colony that fired it, RGBA. */
  ownerColor: readonly number[];
  /** True when it shades the owner's enemies, false for the owner's colony. */
  enemies: boolean;
}

/** True when the tint shades the colony drawn in that colour. */
export function tintApplies(
  tint: ColonyTint,
  colonyColor: readonly number[]
): boolean {
  const owners = sameRgb(tint.ownerColor, colonyColor);
  return tint.enemies ? !owners : owners;
}

/** The radius a shield's tint reaches - the whole colony, wherever it is. */
export const WHOLE_COLONY = 1e6;

/** What a frame hands the effects - see `ArenaFrame`. */
export interface WeaponFrame {
  deltaTimeSec: number;
  timeSec: number;
  reducedMotion: boolean;
  weaponFires: readonly WeaponFire[];
  weaponEffects: readonly ActiveEffect[];
  /** Each seat's colony colour, RGBA. */
  seatColors: ReadonlyMap<number, readonly number[]>;
  particleBudget: number;
}

/**
 * How many particles the weapons may fly at once: as many as the canvas
 * has pixels for, and fewer for players who asked for less motion.
 */
export function particleBudget(
  screen: ScreenResolution,
  reducedMotion: boolean
): number {
  const budget = PARTICLE_BUDGETS[screen] ?? PARTICLE_BUDGETS.medium;
  return reducedMotion ? Math.round(budget * 0.35) : budget;
}

const PARTICLE_BUDGETS: Record<ScreenResolution, number> = {
  low: 90,
  medium: 170,
  high: 260,
  'full-hd': 320,
};

/** The most particles there ever are - the pool is this big. */
export const MAX_PARTICLES = 320;

/** The budget the emission rates below are written for. */
const REFERENCE_BUDGET = 200;

/** Seconds the burst of a weapon being fired lasts. */
export const BURST_SEC = 0.7;
/** Seconds a phage strike stays in view, though it acts for one frame. */
export const STRIKE_SEC = 1.2;
/** Seconds an effect takes to fade in, and to fade out at its end. */
const FADE_IN_SEC = 0.3;
const FADE_OUT_SEC = 0.6;

// The weapons' colours. The main one of each is the colour the menus show
// the weapon in, so a weapon looks the same in both.
const WHITE: Rgb = [255, 255, 255];
const WHITE_HOT: Rgb = [255, 247, 226];
const TOXIC: Rgb = WEAPON_COLORS['toxin-bomb'];
const TOXIC_LIGHT: Rgb = [205, 255, 120];
const TOXIC_DARK: Rgb = [55, 125, 30];
const ICE: Rgb = WEAPON_COLORS['cryo-pulse'];
const ICE_LIGHT: Rgb = [226, 247, 255];
const PHAGE: Rgb = WEAPON_COLORS['phage-strike'];
const GOLD: Rgb = WEAPON_COLORS['agar-bloom'];
const GOLD_DEEP: Rgb = [232, 140, 28];
const GOLD_LIGHT: Rgb = [255, 236, 160];
const GOLD_PALE: Rgb = [255, 250, 215];
const MEMBRANE: Rgb = WEAPON_COLORS['biofilm-shield'];
const SHADOW: Rgb = [0, 0, 0];

/** How a particle looks and moves. */
type ParticleLook = 'spark' | 'spore' | 'sparkle' | 'mote' | 'phage' | 'glint';

interface Particle {
  alive: boolean;
  look: ParticleLook;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Per second, how much of its speed it loses. */
  drag: number;
  /** Cells per second squared - motes rise, spores sink a little. */
  ay: number;
  age: number;
  life: number;
  size: number;
  angle: number;
  spin: number;
  /** Where in its sway or twinkle it starts, radians. */
  phase: number;
  /** A phage's start and the bacterium it homes in on. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: Color;
  /** A phage's: the colour the bacterium it reaches turns to. */
  convert: Color;
}

/** A weapon going off: the shockwave and the flash at the crosshair. */
interface Burst {
  weapon: WeaponId;
  x: number;
  y: number;
  radius: number;
  ownerColor: Color;
  isBot: boolean;
  age: number;
}

/** A phage strike, kept in view after the one frame it acts in. */
interface Strike {
  owner: number;
  x: number;
  y: number;
  radius: number;
  ownerColor: Color;
  age: number;
}

/**
 * The weapons' effects as they are drawn, frame by frame: the bursts of
 * the weapons fired, the effects acting, the particles flying - sorted
 * into three layers and the tints of the colonies:
 *
 * - `ground`, between the floor and the colonies - the agar a bloom grows,
 * - `over`, over the colonies - the toxin cloud, the ice, the membrane,
 * - `light`, added over everything as light - flashes, shockwaves, sparks.
 */
export class WeaponEffects {
  public readonly ground = new MarkLayer();
  public readonly over = new MarkLayer();
  public readonly light = new MarkLayer();
  /** How the effects acting now shade the colonies. */
  public readonly tints: ColonyTint[] = [];
  private readonly bursts: Burst[] = [];
  private readonly strikes: Strike[] = [];
  private readonly particles: Particle[] = [];
  /** Where the search for a free particle starts. */
  private nextParticle = 0;
  private aliveCount = 0;
  private budget = REFERENCE_BUDGET;
  private timeSec = 0;

  public constructor(
    /** Cells per base cell - sparks are as big on every grid. */
    private readonly unit: number,
    /** The effects' own randomness - never the engine's. */
    private readonly random: () => number = renderRandom()
  ) {}

  /** The particles flying right now. */
  public get particleCount(): number {
    return this.aliveCount;
  }

  /** True while anything of a weapon is to be drawn. */
  public get visible(): boolean {
    return (
      this.ground.count + this.over.count + this.light.count > 0 ||
      this.tints.length > 0
    );
  }

  /** Moves everything on by a frame and lays out its marks. */
  public update(frame: WeaponFrame): void {
    const deltaSec = clamp(frame.deltaTimeSec, 0, 0.1);
    this.timeSec = frame.timeSec;
    this.budget = Math.min(MAX_PARTICLES, Math.max(0, frame.particleBudget));
    const colorOf = (seat: number): Color => {
      const color = frame.seatColors.get(seat);
      return color == null ? [255, 255, 255] : [color[0], color[1], color[2]];
    };

    this.age(deltaSec);
    this.advanceParticles(deltaSec);
    for (const fire of frame.weaponFires) {
      this.fire(fire, colorOf(fire.playerId));
    }
    for (const effect of frame.weaponEffects) {
      if (effect.weapon === 'phage-strike') {
        this.strike(effect.owner, effect.x, effect.y, effect.radius, () =>
          colorOf(effect.owner)
        );
      }
    }

    this.ground.clear();
    this.over.clear();
    this.light.clear();
    this.tints.length = 0;
    for (const effect of frame.weaponEffects) {
      if (effect.weapon !== 'phage-strike') {
        this.effectMarks(
          effect,
          frame.seatColors.get(effect.owner) ?? WHITE,
          deltaSec
        );
      }
    }
    for (const strike of this.strikes) {
      this.strikeMarks(strike, deltaSec);
    }
    for (const burst of this.bursts) {
      this.burstMarks(burst);
    }
    this.particleMarks();
  }

  /** Lets go of everything - another match starts. */
  public reset(): void {
    this.bursts.length = 0;
    this.strikes.length = 0;
    for (const particle of this.particles) {
      particle.alive = false;
    }
    this.aliveCount = 0;
    this.ground.clear();
    this.over.clear();
    this.light.clear();
    this.tints.length = 0;
  }

  private age(deltaSec: number): void {
    for (const burst of this.bursts) {
      burst.age += deltaSec;
    }
    for (const strike of this.strikes) {
      strike.age += deltaSec;
    }
    removeWhere(this.bursts, (burst) => burst.age >= BURST_SEC);
    removeWhere(this.strikes, (strike) => strike.age >= STRIKE_SEC);
  }

  /** A weapon fired: its burst, the sparks it throws, a phage's strike. */
  private fire(fire: WeaponFire, ownerColor: Color): void {
    this.bursts.push({
      weapon: fire.weapon,
      x: fire.x,
      y: fire.y,
      radius: fire.radius,
      ownerColor,
      isBot: fire.isBot,
      age: 0,
    });
    const { core, light } = burstColors(fire.weapon, ownerColor);
    const count = Math.round(
      clamp(this.budget * 0.14, 6, 40) *
        (fire.weapon === 'phage-strike' ? 1.4 : 1) *
        (fire.isBot ? 0.7 : 1)
    );
    const look: ParticleLook =
      fire.weapon === 'cryo-pulse'
        ? 'sparkle'
        : fire.weapon === 'toxin-bomb'
          ? 'spore'
          : 'spark';
    const reach = Math.sqrt(Math.max(4, fire.radius) / 18);
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed =
        (look === 'spark' ? 45 + this.random() * 95 : 25 + this.random() * 50) *
        this.unit *
        reach;
      const particle = this.spawn(
        // Every other one a spark: a burst always crackles.
        i % 2 === 0 ? 'spark' : look,
        fire.x,
        fire.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.35 + this.random() * 0.45,
        (0.6 + this.random() * 0.8) * this.unit,
        this.random() < 0.5 ? core : light
      );
      if (particle != null) {
        particle.drag = 3.2;
      }
    }
    if (fire.weapon === 'phage-strike') {
      this.strike(fire.playerId, fire.x, fire.y, fire.radius, () => ownerColor);
    }
  }

  /**
   * A phage strike, once: the strike fired and the one frame it acts in
   * are the same strike. The phages fly in from around it.
   */
  private strike(
    owner: number,
    x: number,
    y: number,
    radius: number,
    colorOf: () => Color
  ): void {
    const known = this.strikes.some(
      (strike) =>
        strike.owner === owner &&
        strike.age < 0.3 &&
        Math.abs(strike.x - x) < 2 &&
        Math.abs(strike.y - y) < 2
    );
    if (known) {
      return;
    }
    const ownerColor = colorOf();
    this.strikes.push({ owner, x, y, radius, ownerColor, age: 0 });
    // The phages in the weapon's colour; the bacteria they turn spark in
    // the striker's.
    const phageColor = mixColor(PHAGE, WHITE, 0.3);
    const turned = mixColor(ownerColor, WHITE, 0.3);
    const count = Math.round(clamp(this.budget * 0.12, 8, 32));
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const from = radius * (1.25 + this.random() * 0.5);
      const toAngle = this.random() * Math.PI * 2;
      const to = Math.sqrt(this.random()) * radius * 0.75;
      const particle = this.spawn(
        'phage',
        x + Math.cos(angle) * from,
        y + Math.sin(angle) * from,
        0,
        0,
        0.28 + this.random() * 0.14,
        (1.1 + this.random() * 0.8) * this.unit,
        phageColor
      );
      if (particle != null) {
        particle.fromX = particle.x;
        particle.fromY = particle.y;
        particle.toX = x + Math.cos(toAngle) * to;
        particle.toY = y + Math.sin(toAngle) * to;
        particle.spin = (this.random() - 0.5) * 12;
        copyColor(particle.convert, turned);
      }
    }
  }

  /** A particle from the pool - null once the budget is spent. */
  private spawn(
    look: ParticleLook,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: Rgb
  ): Particle | null {
    if (this.aliveCount >= this.budget) {
      return null;
    }
    let particle: Particle | undefined;
    if (this.particles.length < MAX_PARTICLES) {
      particle = blankParticle();
      this.particles.push(particle);
    } else {
      for (let tried = 0; tried < this.particles.length; tried++) {
        const candidate = this.particles[this.nextParticle];
        this.nextParticle = (this.nextParticle + 1) % this.particles.length;
        if (!candidate.alive) {
          particle = candidate;
          break;
        }
      }
    }
    if (particle === undefined) {
      return null;
    }
    this.aliveCount++;
    particle.alive = true;
    particle.look = look;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.drag = 0;
    particle.ay = 0;
    particle.age = 0;
    particle.life = life;
    particle.size = size;
    particle.angle = this.random() * Math.PI;
    particle.spin = 0;
    particle.phase = this.random() * Math.PI * 2;
    copyColor(particle.color, color);
    return particle;
  }

  private advanceParticles(deltaSec: number): void {
    for (const particle of this.particles) {
      if (!particle.alive) {
        continue;
      }
      particle.age += deltaSec;
      if (particle.age >= particle.life) {
        particle.alive = false;
        this.aliveCount--;
        if (particle.look === 'phage') {
          // It has reached its bacterium, which turns: sparks fly in the
          // striker's colour.
          this.convertSparks(particle.toX, particle.toY, particle.convert, 3);
        }
        continue;
      }
      if (particle.look === 'phage') {
        const k = easeIn(particle.age / particle.life);
        particle.x = lerp(particle.fromX, particle.toX, k);
        particle.y = lerp(particle.fromY, particle.toY, k);
      } else {
        const keep = Math.exp(-particle.drag * deltaSec);
        particle.vx *= keep;
        particle.vy = particle.vy * keep + particle.ay * deltaSec;
        particle.x += particle.vx * deltaSec;
        particle.y += particle.vy * deltaSec;
      }
      particle.angle += particle.spin * deltaSec;
    }
  }

  /** Sparks where bacteria turn to the striking colony. */
  private convertSparks(x: number, y: number, color: Rgb, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = (12 + this.random() * 22) * this.unit;
      const particle = this.spawn(
        'spark',
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.25 + this.random() * 0.25,
        (0.5 + this.random() * 0.5) * this.unit,
        color
      );
      if (particle != null) {
        particle.drag = 4;
      }
    }
  }

  /** How many particles to emit this frame, at so many a second. */
  private emitCount(perSec: number, deltaSec: number): number {
    const expected = (perSec * deltaSec * this.budget) / REFERENCE_BUDGET;
    const whole = Math.floor(expected);
    return whole + (this.random() < expected - whole ? 1 : 0);
  }

  /** A random point in a circle. */
  private pointIn(x: number, y: number, radius: number): [number, number] {
    const angle = this.random() * Math.PI * 2;
    const distance = Math.sqrt(this.random()) * radius;
    return [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
  }

  /** An effect acting now: its look, its particles and its tint. */
  private effectMarks(
    effect: ActiveEffect,
    ownerRgba: readonly number[],
    deltaSec: number
  ): void {
    const fade = effectFade(effect);
    if (fade <= 0) {
      return;
    }
    const elapsed = Math.max(0, effect.durationSec - effect.remainingSec);
    const ownerColor: Rgb = [ownerRgba[0], ownerRgba[1], ownerRgba[2]];
    switch (effect.weapon) {
      case 'toxin-bomb':
        this.toxinMarks(effect, fade, elapsed, deltaSec);
        break;
      case 'cryo-pulse':
        this.cryoMarks(effect, fade, elapsed, deltaSec);
        break;
      case 'agar-bloom':
        this.bloomMarks(effect, fade, elapsed, deltaSec);
        break;
      case 'biofilm-shield':
        this.shieldMarks(effect, fade, elapsed, ownerColor, deltaSec);
        break;
    }
    const mode = TINT_OF[effect.weapon];
    if (mode !== null) {
      this.tints.push({
        mode,
        x: effect.x,
        y: effect.y,
        radius: mode === 'shield' ? WHOLE_COLONY : effect.radius,
        strength: fade,
        ownerColor: ownerRgba,
        enemies: mode === 'toxin' || mode === 'cryo',
      });
    }
  }

  /**
   * A churning green cloud over the enemy: soft puffs drifting round in
   * it, bubbles swelling and popping, spores drifting off.
   */
  private toxinMarks(
    effect: ActiveEffect,
    fade: number,
    elapsed: number,
    deltaSec: number
  ): void {
    const { x, y } = effect;
    const t = this.timeSec;
    const unit = this.unit;
    const seed = effectSeed(effect);
    const grow = smoothstep(0, 0.45, elapsed);
    const radius = effect.radius * (0.55 + 0.5 * grow);

    const cloud = this.over.add('field', x, y, radius, TOXIC, 0.85 * fade);
    cloud.weapon = 'toxin-bomb';
    copyColor(cloud.color2, TOXIC_DARK);
    cloud.timeSec = t;
    cloud.growth = grow;

    for (let i = 0; i < 8; i++) {
      const turn = i % 2 === 0 ? 1 : -1;
      const angle =
        hash(i, seed, 1) * Math.PI * 2 +
        t * (0.25 + 0.2 * hash(i, seed, 2)) * turn;
      const distance =
        radius * (0.15 + 0.5 * hash(i, seed, 3)) +
        Math.sin(t * 0.9 + i) * radius * 0.06;
      this.over.add(
        'glow',
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance,
        radius * (0.32 + 0.1 * Math.sin(t * 1.2 + i * 1.7)),
        mixColor(TOXIC, TOXIC_LIGHT, hash(i, seed, 4) * 0.6),
        0.28 * fade
      );
    }

    for (let i = 0; i < 7; i++) {
      const period = 0.9 + 0.6 * hash(i, seed, 5);
      const phase = t / period + hash(i, seed, 6);
      const cycle = Math.floor(phase);
      const p = phase - cycle;
      const angle = hash(i, cycle, seed) * Math.PI * 2;
      const distance = Math.sqrt(hash(cycle, i, seed + 1)) * radius * 0.8;
      const bx = x + Math.cos(angle) * distance;
      const by = y + Math.sin(angle) * distance;
      const full = (1.6 + hash(cycle, i, seed + 2)) * unit;
      if (p < 0.8) {
        const size = lerp(0.3, 1, p / 0.8) * full;
        const bubble = this.over.add(
          'ellipse',
          bx,
          by,
          size,
          TOXIC,
          0.6 * fade
        );
        bubble.size = size;
        copyColor(bubble.color2, TOXIC_LIGHT);
        bubble.angle = -Math.PI / 2;
        const shine = this.over.add(
          'ellipse',
          bx - size * 0.35,
          by - size * 0.38,
          size * 0.32,
          WHITE,
          0.55 * fade
        );
        shine.size = size * 0.22;
        shine.angle = -0.6;
      } else {
        const pop = (p - 0.8) / 0.2;
        const ring = this.light.add(
          'ring',
          bx,
          by,
          full * (1 + pop),
          TOXIC_LIGHT,
          (1 - pop) * 0.8 * fade
        );
        ring.size = 0.45 * unit;
      }
    }

    const rim = this.light.add(
      'ring',
      x,
      y,
      radius * (1 + 0.02 * Math.sin(t * 3)),
      TOXIC_LIGHT,
      0.22 * fade
    );
    rim.size = unit;

    for (let n = this.emitCount(36, deltaSec); n > 0; n--) {
      const [sx, sy] = this.pointIn(x, y, radius);
      const away = Math.atan2(sy - y, sx - x);
      const speed = (3 + this.random() * 5) * unit;
      const spore = this.spawn(
        'spore',
        sx,
        sy,
        Math.cos(away) * speed,
        Math.sin(away) * speed - 3 * unit,
        1.2 + this.random(),
        (0.5 + this.random() * 0.5) * unit,
        TOXIC_LIGHT
      );
      if (spore != null) {
        spore.ay = 1.5 * unit;
      }
    }
  }

  /**
   * Ice: a frozen sheet with facets and cracks, a bright rim with frost
   * crystals standing out of it, sparkles glittering over it.
   */
  private cryoMarks(
    effect: ActiveEffect,
    fade: number,
    elapsed: number,
    deltaSec: number
  ): void {
    const { x, y } = effect;
    const t = this.timeSec;
    const unit = this.unit;
    const seed = effectSeed(effect);
    const grow = smoothstep(0, 0.35, elapsed);
    const radius = effect.radius * (0.3 + 0.7 * grow);

    const ice = this.over.add('field', x, y, effect.radius, ICE, 0.8 * fade);
    ice.weapon = 'cryo-pulse';
    copyColor(ice.color2, ICE_LIGHT);
    ice.timeSec = t;
    ice.growth = 0.3 + 0.7 * grow;

    const rim = this.light.add('ring', x, y, radius, ICE_LIGHT, 0.65 * fade);
    rim.size = 1.3 * unit;
    const inner = this.light.add(
      'ring',
      x,
      y,
      radius * 0.86,
      ICE_LIGHT,
      0.25 * fade
    );
    inner.size = 0.5 * unit;

    const crystals = this.budget < 120 ? 10 : 16;
    for (let i = 0; i < crystals; i++) {
      const h = hash(i, seed, 7);
      const angle = ((i + h * 0.6) / crystals) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const length =
        effect.radius *
        (0.16 + 0.16 * h) *
        grow *
        (1 + 0.05 * Math.sin(t * 3 + i));
      const base = radius * 0.97;
      const outward = this.over.add(
        'ellipse',
        x + cos * (base + length * 0.4),
        y + sin * (base + length * 0.4),
        length * 0.5,
        ICE,
        0.9 * fade
      );
      outward.size = Math.max(0.45 * unit, length * 0.12);
      outward.angle = angle;
      copyColor(outward.color2, WHITE);
      const inward = this.over.add(
        'ellipse',
        x + cos * (base - length * 0.25),
        y + sin * (base - length * 0.25),
        length * 0.3,
        ICE_LIGHT,
        0.7 * fade
      );
      inward.size = Math.max(0.35 * unit, length * 0.08);
      inward.angle = angle;
      const tip = base + length * 0.9;
      this.light.add(
        'glow',
        x + cos * tip,
        y + sin * tip,
        1.8 * unit,
        ICE_LIGHT,
        0.6 * fade * (0.5 + 0.5 * Math.sin(t * 5 + i * 2.1))
      );
    }

    for (let n = this.emitCount(45, deltaSec); n > 0; n--) {
      const [sx, sy] = this.pointIn(x, y, radius);
      this.spawn(
        'sparkle',
        sx,
        sy,
        0,
        0,
        0.35 + this.random() * 0.35,
        (0.8 + this.random() * 0.8) * unit,
        ICE_LIGHT
      );
    }
  }

  /**
   * Golden agar unfurling from the centre in two whorls of petals, a warm
   * shimmer over it, motes rising off it.
   */
  private bloomMarks(
    effect: ActiveEffect,
    fade: number,
    elapsed: number,
    deltaSec: number
  ): void {
    const { x, y, radius } = effect;
    const t = this.timeSec;
    const unit = this.unit;
    const grow = smoothstep(0, 1.1, elapsed);
    const turn = hash(effectSeed(effect), 1, 9) * Math.PI;

    const agar = this.ground.add(
      'field',
      x,
      y,
      radius * 1.05,
      GOLD,
      0.75 * fade
    );
    agar.weapon = 'agar-bloom';
    copyColor(agar.color2, GOLD_LIGHT);
    agar.timeSec = t;
    agar.growth = grow;

    const whorls: [number, number, number, Rgb, Rgb, number][] = [
      // petals, length, width, base, tip, offset
      [8, 0.7, 0.2, GOLD_DEEP, GOLD_LIGHT, 0],
      [6, 0.42, 0.24, GOLD, GOLD_PALE, Math.PI / 6],
    ];
    for (const [petals, reach, width, base, tip, offset] of whorls) {
      for (let i = 0; i < petals; i++) {
        const angle = turn + offset + (i / petals) * Math.PI * 2 + t * 0.06;
        const length =
          radius * reach * grow * (0.9 + 0.1 * Math.sin(t * 1.5 + i));
        const petal = this.ground.add(
          'ellipse',
          x + Math.cos(angle) * length * 0.5,
          y + Math.sin(angle) * length * 0.5,
          length * 0.5,
          base,
          0.55 * fade
        );
        petal.size = length * width;
        petal.angle = angle;
        copyColor(petal.color2, tip);
      }
    }
    this.ground.add('glow', x, y, radius * 0.24 * grow, GOLD_PALE, 0.7 * fade);
    this.light.add(
      'glow',
      x,
      y,
      radius,
      [255, 200, 90],
      0.13 * fade * (0.7 + 0.3 * Math.sin(t * 2.4))
    );

    for (let n = this.emitCount(28, deltaSec); n > 0; n--) {
      const [sx, sy] = this.pointIn(x, y, radius * Math.max(0.2, grow));
      const mote = this.spawn(
        'mote',
        sx,
        sy,
        0,
        -(5 + this.random() * 8) * unit,
        1.3 + this.random() * 0.9,
        (0.5 + this.random() * 0.6) * unit,
        GOLD_LIGHT
      );
      if (mote != null) {
        mote.drag = 0.3;
      }
    }
  }

  /**
   * A pulsing membrane of hexagons in the owner's colour, rimmed with light,
   * a few cells of it drifting round the rim and glints running along it.
   * The owner's whole colony wears the membrane too - see its tint.
   */
  private shieldMarks(
    effect: ActiveEffect,
    fade: number,
    elapsed: number,
    ownerColor: Rgb,
    deltaSec: number
  ): void {
    const { x, y, radius } = effect;
    const t = this.timeSec;
    const unit = this.unit;
    const light = mixColor(ownerColor, MEMBRANE, 0.55);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);

    this.ground.add('glow', x, y, radius * 1.15, ownerColor, 0.18 * fade);
    const membrane = this.over.add(
      'field',
      x,
      y,
      radius,
      ownerColor,
      0.75 * fade
    );
    membrane.weapon = 'biofilm-shield';
    copyColor(membrane.color2, light);
    membrane.timeSec = t;
    membrane.growth = smoothstep(0, 0.35, elapsed);

    const rim = this.light.add(
      'ring',
      x,
      y,
      radius,
      light,
      (0.45 + 0.35 * pulse) * fade
    );
    rim.size = 1.4 * unit;
    const halo = this.light.add(
      'ring',
      x,
      y,
      radius * 1.06,
      light,
      0.25 * fade
    );
    halo.size = 0.6 * unit;

    for (let i = 0; i < 6; i++) {
      const angle = t * 0.5 + (i / 6) * Math.PI * 2;
      const cell = this.over.add(
        'hex',
        x + Math.cos(angle) * radius * 0.98,
        y + Math.sin(angle) * radius * 0.98,
        2.2 * unit,
        light,
        0.65 * fade
      );
      cell.size = 0.4 * unit;
      cell.angle = angle;
    }

    for (let n = this.emitCount(16, deltaSec); n > 0; n--) {
      const angle = this.random() * Math.PI * 2;
      const way = this.random() < 0.5 ? 1 : -1;
      const speed = 18 * unit * way;
      this.spawn(
        'glint',
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        -Math.sin(angle) * speed,
        Math.cos(angle) * speed,
        0.5 + this.random() * 0.3,
        (0.8 + this.random() * 0.6) * unit,
        light
      );
    }
  }

  /**
   * A phage strike: a white-hot flash, a wave of hexagons running out over
   * the circle in the striker's colour, and sparks where bacteria turn.
   */
  private strikeMarks(strike: Strike, deltaSec: number): void {
    const { x, y, radius, age, ownerColor } = strike;
    const t = age / STRIKE_SEC;
    const unit = this.unit;
    if (age < 0.2) {
      const flash = 1 - age / 0.2;
      this.light.add('glow', x, y, radius * 1.7, WHITE_HOT, flash * flash);
      this.light.add('glow', x, y, radius * 0.6, WHITE, flash);
    }
    const wave = this.light.add(
      'field',
      x,
      y,
      radius * 1.15,
      WHITE_HOT,
      Math.pow(1 - t, 1.2)
    );
    wave.weapon = 'phage-strike';
    copyColor(wave.color2, ownerColor);
    wave.timeSec = this.timeSec;
    wave.growth = easeOut(t);

    const rim = this.light.add(
      'ring',
      x,
      y,
      radius,
      mixColor(ownerColor, WHITE, 0.4),
      0.5 * (1 - t) * (0.6 + 0.4 * Math.sin(age * 25))
    );
    rim.size = unit;

    if (age > 0.25 && age < 0.9) {
      const sparkColor = mixColor(ownerColor, WHITE, 0.3);
      for (let n = this.emitCount(90, deltaSec); n > 0; n--) {
        const [sx, sy] = this.pointIn(x, y, radius * 0.85);
        this.convertSparks(sx, sy, sparkColor, 1);
      }
    }
  }

  /**
   * A weapon going off: a flash at the crosshair with a white-hot core,
   * a shockwave running out past the circle with a shadow inside it, and
   * a second ring trailing it.
   */
  private burstMarks(burst: Burst): void {
    const { x, y, radius, age, weapon } = burst;
    const unit = this.unit;
    const t = age / BURST_SEC;
    const out = easeOut(t);
    const left = 1 - t;
    const strength = burst.isBot ? 0.75 : 1;
    const { core, light } = burstColors(weapon, burst.ownerColor);

    this.light.add(
      'glow',
      x,
      y,
      radius * (0.3 + 0.45 * out),
      light,
      Math.pow(left, 2.5) * strength
    );
    if (age < 0.14) {
      this.light.add('glow', x, y, radius * 0.22, WHITE, 1 - age / 0.14);
    }
    const shadow = this.over.add(
      'ring',
      x,
      y,
      Math.max(0, radius * 1.25 * out - 1.5 * unit),
      SHADOW,
      0.28 * left * strength
    );
    shadow.size = 2 * unit * left + 0.3 * unit;
    const shock = this.light.add(
      'ring',
      x,
      y,
      radius * 1.25 * out,
      core,
      0.85 * Math.pow(left, 1.4) * strength
    );
    shock.size = Math.max(0.6 * unit, 3 * unit * left);
    if (age > 0.07) {
      const t2 = (age - 0.07) / (BURST_SEC - 0.07);
      const trail = this.light.add(
        'ring',
        x,
        y,
        radius * 0.95 * easeOut(t2),
        light,
        0.6 * (1 - t2) * (1 - t2) * strength
      );
      trail.size = 1.2 * unit * (1 - t2) + 0.3 * unit;
    }
  }

  private particleMarks(): void {
    for (const particle of this.particles) {
      if (!particle.alive) {
        continue;
      }
      const t = particle.age / particle.life;
      const { x, y, size, color } = particle;
      switch (particle.look) {
        case 'spark': {
          // A streak along its flight, longer the faster it flies.
          const speed = Math.hypot(particle.vx, particle.vy);
          const streak = this.light.add(
            'ellipse',
            x,
            y,
            size + speed * 0.025,
            color,
            1 - t
          );
          streak.size = size * 0.45;
          streak.angle = Math.atan2(particle.vy, particle.vx);
          copyColor(streak.color2, WHITE);
          break;
        }
        case 'spore':
          this.light.add('glow', x, y, size * 1.8, color, 0.55 * bell(t));
          break;
        case 'sparkle': {
          // A four-pointed star, twinkling once.
          const twinkle = Math.sin(Math.PI * t);
          for (const turn of [0, Math.PI / 2]) {
            const ray = this.light.add(
              'ellipse',
              x,
              y,
              size * 1.6 * twinkle,
              color,
              twinkle
            );
            ray.size = size * 0.18;
            ray.angle = particle.angle + turn;
          }
          break;
        }
        case 'mote':
          this.light.add(
            'glow',
            x + Math.sin(particle.age * 3 + particle.phase) * 1.2 * this.unit,
            y,
            size * 1.5,
            color,
            0.8 * bell(t)
          );
          break;
        case 'phage': {
          const cell = this.light.add(
            'hex',
            x,
            y,
            size,
            color,
            Math.min(1, particle.age / 0.08)
          );
          cell.size = 0.35 * this.unit;
          cell.angle = particle.angle;
          this.light.add('glow', x, y, size * 2.2, color, 0.3);
          break;
        }
        case 'glint':
          this.light.add('glow', x, y, size * 1.6, color, 0.8 * bell(t));
          break;
      }
    }
  }
}

/** The colours a weapon bursts in - the shield and the phages the owner's. */
export function burstColors(
  weapon: WeaponId,
  ownerColor: Rgb
): { core: Rgb; light: Rgb } {
  switch (weapon) {
    case 'toxin-bomb':
      return { core: TOXIC, light: TOXIC_LIGHT };
    case 'cryo-pulse':
      return { core: ICE, light: ICE_LIGHT };
    case 'phage-strike':
      return { core: WHITE_HOT, light: mixColor(PHAGE, WHITE, 0.35) };
    case 'agar-bloom':
      return { core: GOLD, light: GOLD_LIGHT };
    case 'biofilm-shield':
      return { core: ownerColor, light: mixColor(ownerColor, MEMBRANE, 0.55) };
  }
}

/** How each weapon shades the colonies while it acts. */
const TINT_OF: Record<WeaponId, TintMode | null> = {
  'toxin-bomb': 'toxin',
  'cryo-pulse': 'cryo',
  'phage-strike': null,
  'agar-bloom': 'bloom',
  'biofilm-shield': 'shield',
};

/**
 * How visible an effect is, 0 to 1: it fades in as it starts and out as it
 * ends. A strike acting at once is fully visible.
 */
export function effectFade(effect: ActiveEffect): number {
  if (effect.durationSec <= 0) {
    return 1;
  }
  const elapsed = effect.durationSec - effect.remainingSec;
  return clamp(
    Math.min(1, elapsed / FADE_IN_SEC, effect.remainingSec / FADE_OUT_SEC),
    0,
    1
  );
}

/** A small number the same for an effect all its life, for its layout. */
function effectSeed(effect: ActiveEffect): number {
  return (
    (Math.round(effect.x * 13) + Math.round(effect.y * 7) * 31 + effect.owner) |
    0
  );
}

/**
 * A small, fast random number generator (mulberry32) for the effects -
 * seeded, so a frame of them could be told again, and apart from the
 * engine's.
 */
export function renderRandom(seed = 0x5eed): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blankParticle(): Particle {
  return {
    alive: false,
    look: 'spark',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    drag: 0,
    ay: 0,
    age: 0,
    life: 1,
    size: 1,
    angle: 0,
    spin: 0,
    phase: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    color: [0, 0, 0],
    convert: [0, 0, 0],
  };
}

function removeWhere<T>(items: T[], gone: (item: T) => boolean): void {
  let kept = 0;
  for (const item of items) {
    if (!gone(item)) {
      items[kept++] = item;
    }
  }
  items.length = kept;
}

function copyColor(into: Color, from: Rgb): void {
  into[0] = from[0];
  into[1] = from[1];
  into[2] = from[2];
}

function mixColor(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function sameRgb(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function easeOut(t: number): number {
  const left = 1 - clamp(t, 0, 1);
  return 1 - left * left * left;
}

function easeIn(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * k;
}

/** Up and down again over a life: 0 at either end, 1 in the middle. */
function bell(t: number): number {
  return Math.sin(Math.PI * clamp(t, 0, 1));
}
