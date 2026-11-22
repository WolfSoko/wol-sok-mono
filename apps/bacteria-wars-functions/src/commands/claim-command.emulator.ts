import { useEmulatorDb } from '../testing/emulator';
import { claimCommand } from './claim-command';

/** One delivery of a command's trigger runs it (`test-emulator`). */
const db = useEmulatorDb();

const PATH = 'playGamesSignIns/s1';

describe('claimCommand', () => {
  it('lets exactly one of two deliveries run the command', async () => {
    await db.doc(PATH).set({ uid: 'ada', code: 'c' });
    const claims = await Promise.all([
      claimCommand(db, PATH),
      claimCommand(db, PATH),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimCommand(db, PATH)).toBe(false);
  });

  it('claims neither an answered nor a deleted command', async () => {
    await db.doc(PATH).set({ uid: 'ada', code: 'c', result: { ok: true } });
    expect(await claimCommand(db, PATH)).toBe(false);
    expect(await claimCommand(db, 'playGamesSignIns/gone')).toBe(false);
  });
});
