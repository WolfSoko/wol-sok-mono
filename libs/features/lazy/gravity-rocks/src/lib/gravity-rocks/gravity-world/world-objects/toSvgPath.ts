import { Vector2d } from '@wolsok/utils-math';
import { Force, SpringForce } from './force';

export function toSvgPath(force: Force): string {
  if (force instanceof SpringForce) {
    const { x, y } = force.wo.pos;
    const { x: x2, y: y2 } = force.springEnd;
    return `M${x} ${y} ${x2} ${y2}`;
  }
  return '';
}

export function svgPathForVelocity(pos: Vector2d, vel: Vector2d): string {
  const { x, y } = pos;
  const { x: x2, y: y2 } = pos.add(vel);
  return `M${x} ${y} ${x2} ${y2}`;
}
