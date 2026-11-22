import { useEmulatorDb } from '../testing/emulator';
import { claimSignIn } from './claim';

/** One delivery of a sign-in's trigger runs it (`test-emulator`). */
const db = useEmulatorDb();

const PATH = 'playGamesSignIns/s1';

describe('claimSignIn', () => {
  it('lets exactly one of two deliveries run the sign-in', async () => {
    await db.doc(PATH).set({ uid: 'ada', code: 'c' });
    const claims = await Promise.all([
      claimSignIn(db, PATH),
      claimSignIn(db, PATH),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimSignIn(db, PATH)).toBe(false);
  });

  it('claims neither an answered nor a deleted sign-in', async () => {
    await db.doc(PATH).set({ uid: 'ada', code: 'c', result: { ok: true } });
    expect(await claimSignIn(db, PATH)).toBe(false);
    expect(await claimSignIn(db, 'playGamesSignIns/gone')).toBe(false);
  });
});
