/** Where the light comes from - the top left, as for every glossy UI. */
export const LIGHT_X = -0.6;
export const LIGHT_Y = -0.8;
/**
 * How far the surface light leans over from that direction: the share of
 * it that lies in the plane of the dish, the rest pointing at the viewer.
 */
const SURFACE_TILT = 0.84;

/**
 * What a look is to the painters: whether it is drawn from the colony's
 * blurred density on the fine, smoothly scaled layer - every look but the
 * pixels - how far past the slime's edge it reads and draws, and its value
 * of `uLook` in the colony shader. Both painters read a look from here, so
 * a new look is described once.
 */
export interface LookDescription {
  fromDensity: boolean;
  /**
   * How far past the colony the look reaches, in base cells: the lattice
   * looks lay cells and tiles whose centres lie within the colony but whose
   * bodies reach out, so they read the density and draw that much further.
   */
  reach: number;
  glIndex: number;
}

/**
 * The numbers the looks are tuned by, in one place for both painters: the
 * colony shader gets every one of them as a `const float` of the same name
 * (see `COLONY_FRAGMENT`), so the Canvas and the WebGL painter cannot
 * drift apart. Lengths are in base cells or in spacings, densities on the
 * blurred density's scale, shares from 0 to 1.
 *
 * Cells, as on the app icon: glossy round cells of different sizes on a
 * dark base, on a jittered hex lattice `CELL_SPACING` base cells apart. A
 * cell exists where the density at its centre reaches `CELL_MIN`, grows in
 * over `CELL_GROW` and with the density from `CELL_SIZE_FROM` over
 * `CELL_SIZE_RANGE`, so the cells are small along the front and where the
 * colony is weak, big and tightly packed inside. The WebGL painter draws
 * the same lattice, jittered by its own hash - the two painters agree on
 * the look, not on each cell.
 *
 * Honeycomb and crystal: the colony tiled, every tile the nearest point of
 * a hex lattice `TILE_SPACING` apart - the honeycomb's regular, the
 * crystal's jittered by `CRYSTAL_JITTER` into irregular facets. A tile is
 * laid where the density under its centre reaches `TILE_MIN`. The
 * honeycomb's tiles are glossy with dark seams `TILE_SEAM` wide, the
 * crystal's facets flat, each its own shade, with bright seams.
 *
 * Neon: a dark body whose outline glows in the colony's colour, with a
 * fainter line further in and a soft halo outside.
 *
 * Ink: a flat body hatched with lines `INK_HATCH_SPACING` apart - crossed
 * where the colony is thin - and a thick outline in ink. Each colony is
 * hatched in its own pattern ({@link hatchPattern}).
 *
 * Bubbles: glassy bubbles of different sizes on the cells' lattice,
 * `BUBBLE_SPACING` apart - a faint film, a bright rim and a light spot -
 * each with two or three snippets of DNA inside, double helices that drift
 * around and turn slowly with the time, over a thinner base.
 *
 * The looks that are shaded as surfaces - the marbles, the lava, the
 * chrome - are lit by `SURFACE_LIGHT`, a light above the top left of the
 * dish, towards the viewer; the marbles and the chrome mirror it as a hard
 * highlight.
 *
 * Marbles: glass marbles of different sizes on their own lattice, each a
 * sphere with a swirl of the light colour inside, `MARBLE_SWIRL_TURNS`
 * around and `MARBLE_SWIRL_RINGS` out, a dark rim, the highlight and a glow
 * on the side the light leaves, as light does through glass.
 *
 * Lava: a dark, greyed crust over the colony, bulging where the density
 * rises, with cracks where a slowly flowing noise crosses two of its
 * levels, glowing in the hot colour and breathing with `LAVA_PULSE`; the
 * front of the colony glows molten.
 *
 * Galaxy: deep space in the colony's colour - clouds of gas where one noise
 * is dense, tinted by another, stars on a lattice `GALAXY_STAR_SPACING`
 * base cells wide that twinkle, a bright core where the colony is thick and
 * a faint rim.
 *
 * Plasma: a dark body full of arcs, the ridges of two noises moving with
 * the time, sharpened to `PLASMA_SHARP`, with a soft halo around them and a
 * flicker; the outline glows like the neon's.
 *
 * Chrome: liquid metal - the surface rises along the front like a bevel
 * (`CHROME_RELIEF` per cell of density) and ripples inside, and mirrors a
 * sky: bright above the horizon, the colony's colour at it, dark below,
 * with the highlight and a bright fresnel rim.
 *
 * Eclipse, the boss's: a black body in `ECLIPSE_BODY` of the colour that
 * swallows the light, veined where a slowly flowing noise `ECLIPSE_SCALE`
 * base cells wide crosses its middle, the veins glowing with a heartbeat
 * of `ECLIPSE_PULSE`; a corona blazing along the rim, its limb fading in
 * over `ECLIPSE_LIMB_END` of density, and flares licking out past the
 * edge where a noise rolling around the colony runs above
 * `ECLIPSE_FLARE_FROM`.
 */
export const LOOK_TUNING = {
  LIGHT_X,
  LIGHT_Y,
  SURFACE_LIGHT_X: LIGHT_X * SURFACE_TILT,
  SURFACE_LIGHT_Y: LIGHT_Y * SURFACE_TILT,
  SURFACE_LIGHT_Z: Math.sqrt(1 - SURFACE_TILT * SURFACE_TILT),
  MARBLE_SPACING: 4,
  MARBLE_RADIUS: 0.7,
  MARBLE_RADIUS_MIN: 0.5,
  MARBLE_RADIUS_VARY: 0.8,
  MARBLE_BASE_ALPHA: 0.85,
  MARBLE_SWIRL: 0.7,
  MARBLE_SWIRL_TURNS: 2,
  MARBLE_SWIRL_RINGS: 5,
  MARBLE_AMBIENT: 0.35,
  MARBLE_SHINE: 40,
  MARBLE_SHINE_STRENGTH: 0.9,
  MARBLE_RIM_START: 0.7,
  MARBLE_RIM: 0.6,
  MARBLE_GLOW_START: 0.45,
  MARBLE_GLOW_END: 0.95,
  MARBLE_GLOW: 0.55,
  /** The lava's noise: base cells per unit, and how fast it flows. */
  LAVA_SCALE: 5,
  LAVA_FLOW: 0.04,
  /**
   * Half the width of a crack's white-hot core and of the glow around it,
   * on the noise, how bright the glow is, and the second level cracked.
   */
  LAVA_CRACK: 0.035,
  LAVA_CRACK_HALO: 0.09,
  LAVA_HALO: 0.7,
  LAVA_CRACK_2: 0.28,
  LAVA_CRUST: 0.3,
  LAVA_GREY: 0.35,
  LAVA_RELIEF: 10,
  LAVA_BUMP: 0.8,
  LAVA_PULSE: 2.2,
  LAVA_GLOW_LIGHT: 0.45,
  LAVA_EDGE_END: 0.34,
  LAVA_EDGE_GLOW: 0.7,
  LAVA_ALPHA: 0.96,
  GALAXY_SCALE: 4,
  GALAXY_DRIFT: 0.03,
  GALAXY_DEEP: 0.07,
  GALAXY_GAS: 1.1,
  GALAXY_GAS_FROM: 0.5,
  GALAXY_GAS_TO: 0.9,
  /** The stars' lattice in base cells, the share of its cells with a star, a star's radius and its halo's, in cells. */
  GALAXY_STAR_SPACING: 1.5,
  GALAXY_STAR_SHARE: 0.22,
  GALAXY_STAR_RADIUS: 0.16,
  GALAXY_STAR_HALO: 0.45,
  GALAXY_TWINKLE: 3,
  GALAXY_CORE: 0.15,
  GALAXY_RIM: 0.35,
  GALAXY_ALPHA: 0.95,
  PLASMA_SCALE: 7,
  PLASMA_SCALE_2: 3.5,
  PLASMA_SPEED: 0.35,
  /** Half the width of an arc and of its halo, on the noise, and how bright the halo is. */
  PLASMA_BOLT: 0.05,
  PLASMA_HALO_WIDTH: 0.2,
  PLASMA_HALO: 0.2,
  PLASMA_BODY: 0.18,
  PLASMA_GLOW: 1,
  PLASMA_FLICKER: 17,
  PLASMA_EDGE: 0.9,
  PLASMA_ALPHA: 0.92,
  CHROME_RELIEF: 12,
  /** The ripple inside: its strength, its noise's base cells per unit and the step its slope is read over. */
  CHROME_RIPPLE: 4,
  CHROME_RIPPLE_SCALE: 7,
  CHROME_RIPPLE_STEP: 0.5,
  /** The sky and the ground the metal mirrors, and how far from the horizon each is reached. */
  CHROME_SKY: 0.8,
  CHROME_SKY_REACH: 0.9,
  CHROME_GROUND: 0.6,
  CHROME_GROUND_REACH: 0.7,
  CHROME_STREAK: 0.2,
  CHROME_SHINE: 28,
  CHROME_SHINE_STRENGTH: 0.9,
  CHROME_FRESNEL: 0.6,
  CHROME_ALPHA: 0.97,
  CELL_SPACING: 3.4,
  /** The height of a lattice row, in spacings - a hex lattice. */
  CELL_ROW_HEIGHT: 0.866,
  /** How far a cell's centre strays from its lattice point, in spacings. */
  CELL_JITTER: 0.5,
  CELL_MIN: 0.12,
  CELL_GROW: 0.08,
  CELL_SIZE_FROM: 0.15,
  CELL_SIZE_RANGE: 0.6,
  /** The biggest cell, in spacings - neighbours just overlap. */
  CELL_RADIUS: 0.62,
  /** A cell's radius varies by lattice point, from this share up by this much. */
  CELL_RADIUS_MIN: 0.82,
  CELL_RADIUS_VARY: 0.36,
  /** Where the light spot sits on a cell, on its unit disc. */
  CELL_FOCAL_X: -0.35,
  CELL_FOCAL_Y: -0.4,
  /** The sphere gradient: light to the body colour to here, dark beyond. */
  SPHERE_BODY_STOP: 0.55,
  SPHERE_REACH: 1.25,
  /** The light and the dark shade of the colour, towards white and black. */
  TINT_LIGHT: 0.55,
  TINT_DARK: 0.5,
  /** The base under the cells and the tiles: how dark, and how opaque. */
  CELL_BASE: 0.42,
  BASE_ALPHA: 0.92,
  /** The density below which no cell shows, so none floats over bare floor. */
  CELL_CLIP_START: 0.03,
  CELL_CLIP_END: 0.09,
  TILE_SPACING: 2.8,
  TILE_MIN: 0.12,
  TILE_FADE: 0.1,
  /** The sphere a honeycomb tile is shaded as, in spacings. */
  TILE_RADIUS: 0.55,
  CRYSTAL_JITTER: 0.3,
  TILE_SEAM: 0.12,
  /** How dark the honeycomb's seams are. */
  SEAM_DARK: 0.45,
  /** A crystal facet's shade, from this up by this much, by lattice point. */
  CRYSTAL_SHADE_MIN: 0.7,
  CRYSTAL_SHADE_VARY: 0.5,
  NEON_LINE_START: 0.04,
  NEON_LINE_END: 0.24,
  NEON_INNER_START: 0.38,
  NEON_INNER_END: 0.45,
  NEON_INNER_GLOW: 0.6,
  NEON_LIGHT: 0.45,
  NEON_HALO: 0.45,
  NEON_BODY: 0.22,
  NEON_BODY_ALPHA: 0.85,
  INK_HATCH_SPACING: 2.2,
  INK_HATCH_WIDTH: 0.4,
  INK_OUTLINE_END: 0.31,
  INK_CROSS_BELOW: 0.45,
  INK: 0.18,
  INK_HATCH: 0.62,
  INK_ALPHA: 0.95,
  BUBBLE_SPACING: 4.4,
  /** A bubble's radius in spacings, varied by lattice point from this share up by this much. */
  BUBBLE_RADIUS: 0.72,
  BUBBLE_RADIUS_MIN: 0.55,
  BUBBLE_RADIUS_VARY: 0.7,
  BUBBLE_BASE_ALPHA: 0.7,
  /** The film of a bubble: how opaque, and the rim and the light spot on it. */
  BUBBLE_FILM: 0.2,
  BUBBLE_RIM_START: 0.72,
  BUBBLE_RIM_END: 0.96,
  BUBBLE_RIM: 0.9,
  BUBBLE_SPOT_START: 0.12,
  BUBBLE_SPOT_END: 0.3,
  /** A DNA snippet on the bubble's unit disc: half its length, its helix and its drift. */
  DNA_HALF_MIN: 0.22,
  DNA_HALF_VARY: 0.3,
  DNA_AMPLITUDE: 0.07,
  DNA_TWIST: 14,
  DNA_WIDTH: 0.025,
  DNA_RUNG: 0.35,
  DNA_ORBIT_MIN: 0.12,
  DNA_ORBIT_VARY: 0.4,
  DNA_DRIFT: 0.2,
  DNA_SPIN: 0.4,
  ECLIPSE_SCALE: 7,
  ECLIPSE_FLOW: 0.15,
  ECLIPSE_VEIN: 0.045,
  ECLIPSE_VEIN_GLOW: 0.7,
  ECLIPSE_PULSE: 2.5,
  ECLIPSE_BODY: 0.1,
  ECLIPSE_RIM: 1,
  ECLIPSE_LIMB: 0.6,
  ECLIPSE_LIMB_END: 0.5,
  ECLIPSE_FLARE_SCALE: 3,
  ECLIPSE_FLARE_SPEED: 0.6,
  ECLIPSE_FLARE_FROM: 0.45,
  ECLIPSE_FLARE_TO: 0.8,
  ECLIPSE_FLARE_BASE: 0.35,
  ECLIPSE_FLARE: 1,
  ECLIPSE_ALPHA: 0.97,
} as const;
