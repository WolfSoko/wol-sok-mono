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
    wo.pos = vec2(1, 0);
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
});
