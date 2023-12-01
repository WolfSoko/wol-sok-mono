import { Vector2d } from '@wolsok/utils-math';
import { Force, SpringForce } from './force';
import { SvgPath } from './svg-path';

export function toSvgPath(force: Force): SvgPath | null {
  if (force instanceof SpringForce) {
    const { x, y } = force.wo.pos;
    const { x: x2, y: y2 } = force.springEnd;
    return { id: force.id, path: `M${x} ${y} ${x2} ${y2}` };
  }
  return null;
}

export function svgPathForVelocity(
  id: string,
  pos: Vector2d,
  vel: Vector2d
): SvgPath {
  const { x, y } = pos;
  const { x: x2, y: y2 } = pos.add(vel);
  return { id, path: `M${x} ${y} ${x2} ${y2}` };
}
