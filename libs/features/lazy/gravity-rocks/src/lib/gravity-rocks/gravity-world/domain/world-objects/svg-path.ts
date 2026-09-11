export interface SvgPath {
  id: string;
  path: string;
}

/**
 * One chunk of a planet trail. Splitting a trail into a handful of chunks lets
 * the tail fade out and taper towards its oldest end with plain SVG strokes.
 */
export interface TrailSegment extends SvgPath {
  color: string;
  opacity: number;
  width: number;
}
