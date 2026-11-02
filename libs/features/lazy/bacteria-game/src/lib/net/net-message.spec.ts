import { agreedRuleset, NET_VERSION, parseNetMessage } from './net-message';

const send = (value: unknown) => JSON.stringify(value);

describe('parseNetMessage', () => {
  it('reads every kind of message', () => {
    expect(parseNetMessage(send({ k: 'hello', v: NET_VERSION }))).toEqual({
      k: 'hello',
      v: NET_VERSION,
      id: null,
      r: ['cpu'],
    });
    expect(
      parseNetMessage(
        send({ k: 'hello', v: NET_VERSION, id: 'uid_1-A', r: ['gpu-int'] })
      )
    ).toEqual({
      k: 'hello',
      v: NET_VERSION,
      id: 'uid_1-A',
      r: ['cpu', 'gpu-int'],
    });
    expect(
      parseNetMessage(
        send({ k: 'hello', v: NET_VERSION, id: '../x', r: ['gpu', 7, 'cpu'] })
      )
    ).toEqual({ k: 'hello', v: NET_VERSION, id: null, r: ['cpu'] });
    expect(
      parseNetMessage(
        send({ k: 'setup', levelId: 'petri-dish', colors: ['orange', 'blue'] })
      )
    ).toEqual({
      k: 'setup',
      levelId: 'petri-dish',
      colors: ['orange', 'blue'],
    });
    expect(
      parseNetMessage(
        send({
          k: 'start',
          n: 2,
          seed: 77,
          levelId: 'petri-dish',
          colors: ['orange', 'blue'],
          ruleset: 'gpu-int',
        })
      )
    ).toEqual({
      k: 'start',
      n: 2,
      seed: 77,
      levelId: 'petri-dish',
      colors: ['orange', 'blue'],
      ruleset: 'gpu-int',
    });
    expect(
      parseNetMessage(
        send({
          k: 'in',
          n: 1,
          t: 9,
          steer: [0.5, -1],
          drag: [3, 4],
          boost: true,
        })
      )
    ).toEqual({
      k: 'in',
      n: 1,
      t: 9,
      steer: [0.5, -1],
      drag: [3, 4],
      boost: true,
    });
    expect(parseNetMessage(send({ k: 'sum', n: 1, t: 60, h: 99 }))).toEqual({
      k: 'sum',
      n: 1,
      t: 60,
      h: 99,
    });
    expect(parseNetMessage(send({ k: 'bye' }))).toEqual({ k: 'bye' });
  });

  it('drops what is no message of this game', () => {
    expect(parseNetMessage('{')).toBeNull();
    expect(parseNetMessage(42)).toBeNull();
    expect(parseNetMessage(send({ k: 'teleport' }))).toBeNull();
    expect(
      parseNetMessage(
        send({ k: 'setup', levelId: 'nowhere', colors: ['orange', 'blue'] })
      )
    ).toBeNull();
    expect(
      parseNetMessage(
        send({ k: 'setup', levelId: 'petri-dish', colors: ['blue', 'blue'] })
      )
    ).toBeNull();
    // A push harder than a stick's, a tick before the match.
    expect(
      parseNetMessage(
        send({ k: 'in', n: 1, t: 9, steer: [5, 0], drag: null, boost: false })
      )
    ).toBeNull();
    expect(
      parseNetMessage(
        send({ k: 'in', n: 1, t: -1, steer: [0, 0], drag: null, boost: false })
      )
    ).toBeNull();
    expect(
      parseNetMessage(
        send({
          k: 'start',
          n: 1,
          seed: -3,
          levelId: 'petri-dish',
          colors: ['orange', 'blue'],
          ruleset: 'cpu',
        })
      )
    ).toBeNull();
    expect(
      parseNetMessage(
        send({
          k: 'start',
          n: 1,
          seed: 3,
          levelId: 'petri-dish',
          colors: ['orange', 'blue'],
          ruleset: 'gpu',
        })
      )
    ).toBeNull();
  });
});

describe('agreedRuleset', () => {
  it('takes gpu-int only when both devices offer it', () => {
    expect(agreedRuleset(['cpu', 'gpu-int'], ['cpu', 'gpu-int'])).toBe(
      'gpu-int'
    );
    expect(agreedRuleset(['cpu', 'gpu-int'], ['cpu'])).toBe('cpu');
    expect(agreedRuleset(['cpu'], ['cpu', 'gpu-int'])).toBe('cpu');
    expect(agreedRuleset(['cpu'], ['cpu'])).toBe('cpu');
  });
});
