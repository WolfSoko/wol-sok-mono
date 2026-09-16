import { vec2 } from '@wolsok/utils-math';
import { WorldObject } from '../domain/world-objects/world-object';
import { SPRING_SPEED_PER_AU, SpringForce } from './spring-force';

describe('SpringForce', () => {
  it('should draw itself from the object to the hand holding it', () => {
    const force = new SpringForce(new WorldObject(vec2(10, 20), undefined, 1));
    force.updateSpringEnd(vec2(30, 40));

    expect(force.svgPath()?.path).toBe('M10 20 30 40');
  });

  it('should only pull on the object it was hooked onto', () => {
    const held = new WorldObject(vec2(0, 0), undefined, 1);
    const other = new WorldObject(vec2(0, 0), undefined, 1);
    const force = new SpringForce(held);
    force.updateSpringEnd(vec2(1, 0));

    force.applyForceFor(other);
    other.integrate(1);

    expect(other.vel.length()).toBe(0);
  });

  it('should pull the object towards the hand', () => {
    const held = new WorldObject(vec2(0, 0), undefined, 1);
    const force = new SpringForce(held);
    force.updateSpringEnd(vec2(1, 0));

    force.applyForceFor(held);
    held.integrate(1 / 60);

    expect(held.vel.x).toBeGreaterThan(0);
    expect(held.vel.y).toBe(0);
  });

  it('should balance pull and braking out at the handover speed', () => {
    // a hand held still leaves the body at `stiffness / damping` per AU of
    // stretch, which is the speed a released drag is worth
    const held = new WorldObject(vec2(0, 0), undefined, 1);
    const force = new SpringForce(held);
    force.updateSpringEnd(vec2(1, 0));
    for (let i = 0; i < 2000; i++) {
      force.applyForceFor(held);
      held.integrate(1 / 600);
      force.updateSpringEnd(held.pos.add(vec2(1, 0)));
    }

    expect(held.vel.x).toBeCloseTo(SPRING_SPEED_PER_AU, 1);
  });
});
