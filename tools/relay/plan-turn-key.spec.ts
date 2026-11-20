import { describe, expect, it } from '@jest/globals';
import { planTurnKey } from './plan-turn-key';

const NAME = 'bacteria-wars-online';

describe('planTurnKey', () => {
  it('keeps the key the secret names', () => {
    expect(planTurnKey([{ uid: 'k1', name: NAME }], 'k1', NAME)).toEqual({
      action: 'keep',
      uid: 'k1',
      remove: [],
    });
  });

  it('creates a key when there is none', () => {
    expect(planTurnKey([], null, NAME)).toEqual({
      action: 'create',
      remove: [],
    });
  });

  it('creates a key when the secret names none of the keys, and removes those', () => {
    expect(planTurnKey([{ uid: 'k1', name: NAME }], null, NAME)).toEqual({
      action: 'create',
      remove: ['k1'],
    });
    expect(planTurnKey([{ uid: 'k1', name: NAME }], 'gone', NAME)).toEqual({
      action: 'create',
      remove: ['k1'],
    });
  });

  it('removes the other keys of the name beside the one it keeps', () => {
    expect(
      planTurnKey(
        [
          { uid: 'k1', name: NAME },
          { uid: 'k2', name: NAME },
        ],
        'k2',
        NAME
      )
    ).toEqual({ action: 'keep', uid: 'k2', remove: ['k1'] });
  });

  it('leaves keys of other names alone', () => {
    expect(
      planTurnKey(
        [
          { uid: 'k1', name: 'another-app' },
          { uid: 'k2', name: NAME },
        ],
        'k1',
        NAME
      )
    ).toEqual({ action: 'create', remove: ['k2'] });
  });
});
