import { vec2 } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

describe('WorldObject', () => {
  let wo: WorldObject;

  beforeEach(() => {
    wo = new WorldObject(vec2(0, 0), undefined, 10);
  });

  it('should start without a trail', () => {
    expect(wo.trail).toEqual([]);
  });

  it('should record the current position', () => {
    wo.recordTrail(10);
    wo.pos = vec2(100, 0);
    wo.recordTrail(10);

    expect(wo.trail).toEqual([vec2(0, 0), vec2(100, 0)]);
  });

  it('should skip positions that are too close to the last one', () => {
    wo.recordTrail(10);
    // a thousandth of an AU: the world keeps no point that near the last
    wo.pos = vec2(0.001, 0);
    wo.recordTrail(10);

    expect(wo.trail).toEqual([vec2(0, 0)]);
  });

  it('should drop the oldest positions beyond the given maximum', () => {
    for (let i = 0; i < 5; i++) {
      wo.pos = vec2(i * 10, 0);
      wo.recordTrail(3);
    }

    expect(wo.trail).toEqual([vec2(20, 0), vec2(30, 0), vec2(40, 0)]);
  });

  it('should clear the trail for a maximum of zero', () => {
    wo.recordTrail(10);
    wo.recordTrail(0);

    expect(wo.trail).toEqual([]);
  });

  it('should clear the trail on demand', () => {
    wo.recordTrail(10);
    wo.clearTrail();

    expect(wo.trail).toEqual([]);
  });

  describe('being moved', () => {
    it('should gather every pull before any of it moves the body', () => {
      wo.addForce(vec2(10, 0));
      wo.addForce(vec2(0, 10));

      expect(wo.pos).toEqual(vec2(0, 0));

      wo.integrate(1);

      // one newton per kilo each way, so one step of velocity each way
      expect(wo.vel).toEqual(vec2(1, 1));
      expect(wo.pos).toEqual(vec2(1, 1));
    });

    it('should carry the body by the velocity the pull has just changed', () => {
      wo.vel = vec2(2, 0);

      wo.addForce(vec2(10, 0));
      wo.integrate(1);

      // the pull goes in first and the new velocity does the carrying - a
      // leapfrog. Splitting the pull around the move would leave the body at
      // 2.5 and let an orbit spiral outwards, step by step
      expect(wo.vel).toEqual(vec2(3, 0));
      expect(wo.pos).toEqual(vec2(3, 0));
    });

    it('should coast on when nothing pulls on it', () => {
      wo.vel = vec2(0.5, 0);

      wo.integrate(2);

      expect(wo.pos).toEqual(vec2(1, 0));
    });

    it('should leave a static body where it is', () => {
      wo.isStatic = true;
      wo.vel = vec2(5, 0);

      wo.addForce(vec2(10, 0));
      wo.integrate(1);

      expect(wo.pos).toEqual(vec2(0, 0));
      expect(wo.vel).toEqual(vec2(5, 0));
    });

    it('should move a static body for a force that overrules that', () => {
      wo.isStatic = true;

      // the spring of a drag, which a paused or pinned object still follows
      wo.addForce(vec2(10, 0), true);
      wo.integrate(1);

      expect(wo.pos).toEqual(vec2(1, 0));
    });

    it('should forget the pull of a tick that is over', () => {
      wo.addForce(vec2(10, 0));
      wo.integrate(1);

      wo.integrate(1);

      // still coasting at the one step it was given, not pulled twice
      expect(wo.vel).toEqual(vec2(1, 0));
      expect(wo.pos).toEqual(vec2(2, 0));
    });
  });
});
