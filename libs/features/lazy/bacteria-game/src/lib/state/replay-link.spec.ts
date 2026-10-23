import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { Replay, replayOf } from './replay';
import { replayFromHash, replayLink } from './replay-link';

const PLAN: MatchPlan = {
  levelId: 'corridors',
  mode: 'vs-computer',
  difficulty: 'hard',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 640,
  height: 360,
  seed: 4242,
};

/** A run of a minute where the human steers with a stick all the time. */
function run(): Replay {
  const { spawns, options } = planMatch(PLAN);
  const engine = new MatchEngine(spawns, options);
  for (let tick = 0; tick < 3600; tick++) {
    const angle = tick / 50;
    engine.setSteering(0, { x: Math.cos(angle), y: Math.sin(angle) });
    if (tick % 600 === 0) {
      engine.boost(0);
    }
    engine.tick(PLAN.width, PLAN.height);
  }
  return replayOf(PLAN, 'cpu', engine.tickCount, engine.recorded);
}

describe('replay links', () => {
  const replay = run();

  it('carry a run in the hash and give it back as it was', async () => {
    const link = await replayLink('https://wolfsoko.de/bacteriaGame', replay);

    expect(link.startsWith('https://wolfsoko.de/bacteriaGame#ghost=')).toBe(
      true
    );
    expect(link).toMatch(/^[^#]+#ghost=[\w-]+$/);
    expect(await replayFromHash(new URL(link).hash)).toEqual(replay);
  });

  it('carry the weapons fired and the loadouts played with', async () => {
    const evolved: Replay = {
      header: {
        ...replay.header,
        loadouts: [
          { genes: { mitosis: 2, flagella: 5 }, weapon: 'cryo-pulse' },
          { genes: {}, weapon: null },
        ],
      },
      inputs: {
        ...replay.inputs,
        weapons: [
          [100, 0],
          [1700, 0],
        ],
      },
    };

    const link = await replayLink('https://x.y/', evolved);

    expect(await replayFromHash(new URL(link).hash)).toEqual(evolved);
  });

  it('read a plain run - packed as before the weapons - without any', async () => {
    const link = await replayLink('https://x.y/', replay);

    expect((await replayFromHash(new URL(link).hash))?.inputs.weapons).toEqual(
      []
    );
  });

  it('stay short enough to share for a minute of steering', async () => {
    const link = await replayLink('https://wolfsoko.de/bacteriaGame', replay);

    // A stick turned all the time changes direction every few ticks.
    expect(replay.inputs.steers.length).toBeGreaterThan(1000);
    expect(link.length).toBeLessThan(8 * 1024);
  });

  it('replace a run the page had in its hash already', async () => {
    const link = await replayLink('https://wolfsoko.de/game#ghost=old', replay);

    expect(link.split('#')).toHaveLength(2);
  });

  it.each([
    ['no hash', ''],
    ['another hash', '#about'],
    ['an empty run', '#ghost='],
    ['no run at all', '#ghost=bm90IGEgcnVu'],
    ['broken base64', '#ghost=***'],
  ])('carry nothing with %s', async (_, hash) => {
    expect(await replayFromHash(hash)).toBeNull();
  });

  it('carry nothing from another balance of the game', async () => {
    const link = await replayLink('https://x.y/', {
      ...replay,
      header: {
        ...replay.header,
        balanceVersion: replay.header.balanceVersion + 1,
      },
    });

    expect(await replayFromHash(new URL(link).hash)).toBeNull();
  });

  it('carry nothing from another version of the game', async () => {
    const link = await replayLink('https://x.y/', {
      ...replay,
      header: { ...replay.header, version: replay.header.version + 1 },
    });

    expect(await replayFromHash(new URL(link).hash)).toBeNull();
  });
});
