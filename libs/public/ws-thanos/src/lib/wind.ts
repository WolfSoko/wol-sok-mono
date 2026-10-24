/** the dust blows to the top right unless told otherwise */
export const DEFAULT_WIND_DIRECTION = 45;

/**
 * Where the dust blows to. The simulation is written for the default wind,
 * every force it applies is rotated by the difference to this one.
 */
export interface Wind {
  /** unit vector of the direction in screen coordinates, y points down */
  x: number;
  y: number;
  /** rotation from the default wind to this one */
  cos: number;
  sin: number;
}

/**
 * room around the element for the dust to fly in, in element widths (left, right)
 * and element heights (top, bottom)
 */
export interface EffectMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** how far the default wind carries the dust: one width to the right, four heights up */
const ROOM_X = 1;
const ROOM_Y = 4;
/** released dust flies within this many degrees of the wind direction */
const SPREAD = 45;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** a direction that is no number blows the default way */
const validDegrees = (degrees: number): number =>
  Number.isFinite(degrees) ? degrees : DEFAULT_WIND_DIRECTION;

/**
 * @param degrees direction the dust blows to, clockwise from up like a css gradient angle:
 * 0 up, 90 right, 180 down, 270 left
 */
export function windOf(degrees = DEFAULT_WIND_DIRECTION): Wind {
  const direction = toRadians(validDegrees(degrees));
  const rotation = toRadians(validDegrees(degrees) - DEFAULT_WIND_DIRECTION);
  return {
    x: Math.sin(direction),
    y: -Math.cos(direction),
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
  };
}

/**
 * The effect canvas reaches past the element where the dust can fly:
 * for the default wind one width to the right and four heights up, like before there was a wind.
 */
export function effectMargins(degrees = DEFAULT_WIND_DIRECTION): EffectMargins {
  const from = validDegrees(degrees) - SPREAD;
  // the dust flies into every direction between from and from + 2 * SPREAD
  const reach = (side: number): number => {
    const toSide = (((side - from) % 360) + 360) % 360;
    if (toSide <= 2 * SPREAD) {
      return 1;
    }
    const nearest = Math.max(
      Math.cos(toRadians(side - from)),
      Math.cos(toRadians(side - from - 2 * SPREAD))
    );
    // round away float noise, cos(90°) is not exactly 0
    return Math.max(0, Math.round(nearest * 1e6) / 1e6);
  };
  return {
    left: ROOM_X * reach(270),
    right: ROOM_X * reach(90),
    top: ROOM_Y * reach(0),
    bottom: ROOM_Y * reach(180),
  };
}

/** size of the effect canvas in element sizes */
export function effectScale(margins: EffectMargins): {
  width: number;
  height: number;
} {
  return {
    width: 1 + margins.left + margins.right,
    height: 1 + margins.top + margins.bottom,
  };
}
