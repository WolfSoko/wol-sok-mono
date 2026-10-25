import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { handleSite } from './public-site';

/**
 * `publicSite` against the Firestore emulator (`test-emulator`): what each
 * path answers, read from `publicReplays` alone.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const UP = 'AbCdEfGhIjKlMnOpQrSt';
const DOWN = 'ZyXwVuTsRqPoNmLkJiHg';

beforeEach(async () => {
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  const replay = (id: string, removedAt: Timestamp | null, at: number) =>
    db.doc(`publicReplays/${id}`).set({
      replayId: `l_${id}`,
      uids: ['ada'],
      levelId: 'quarantine',
      kind: 'computer',
      players: [
        { label: 'orange', name: 'Ada', colorId: 'orange', avatarPreset: 1 },
        { label: 'computer', name: null, colorId: 'blue', avatarPreset: 0 },
      ],
      ticks: 5_400,
      endedBy: 'annihilation',
      winnerSeat: 0,
      score: 70,
      reasons: ['close'],
      summary: { sizes: [10, 8], timeline: [8, 10, 10, 8] },
      featuredAt: Timestamp.fromMillis(at),
      removedAt,
    });
  await replay(UP, null, Date.UTC(2026, 9, 26));
  await replay(
    DOWN,
    Timestamp.fromMillis(Date.UTC(2026, 9, 27)),
    Date.UTC(2026, 9, 25)
  );
  await db
    .doc(`publicReplays/${UP}/blob/data`)
    .set({ bytes: Buffer.from([1, 2, 3]), size: 3 });
  // A private replay: never served.
  await db.doc('replays/l_private').set({ players: ['ada'] });
});

const get = (path: string, query: Record<string, unknown> = {}) =>
  handleSite(db, 'GET', path, query);

describe('publicSite', () => {
  it('serves the gallery with the replays still up, in its language', async () => {
    const page = await get('/replays', { lang: 'de' });
    expect(page.status).toBe(200);
    expect(page.headers['Cache-Control']).toBe(
      'public, max-age=60, s-maxage=120'
    );
    expect(page.body).toContain(`/replays/${UP}?lang=de`);
    expect(page.body).not.toContain(DOWN);
    const list = await get('/replays/index.json');
    expect(list.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(
      JSON.parse(list.body).replays.map((r: { id: string }) => r.id)
    ).toEqual([UP]);
  });

  it('serves one replay, its bytes for the viewer, and the sitemap', async () => {
    expect((await get(`/replays/${UP}`)).body).toContain('Ada');
    expect(JSON.parse((await get(`/replays/${UP}/replay.json`)).body)).toEqual({
      bytes: Buffer.from([1, 2, 3]).toString('base64'),
    });
    const xml = await get('/replays/sitemap.xml');
    expect(xml.headers['Content-Type']).toBe('application/xml');
    expect(xml.body).toContain(`/replays/${UP}</loc>`);
    expect(xml.body).not.toContain(DOWN);
  });

  it('pages back through matches published together, every one linked once', async () => {
    const at = Timestamp.fromMillis(Date.UTC(2026, 9, 24));
    const batch = db.batch();
    for (let i = 0; i < 60; i++) {
      batch.set(db.doc(`publicReplays/Batch${String(i).padStart(15, '0')}`), {
        levelId: 'quarantine',
        kind: 'computer',
        players: [],
        ticks: 60,
        winnerSeat: null,
        score: 60,
        reasons: [],
        featuredAt: at,
        removedAt: null,
      });
    }
    await batch.commit();
    const first = JSON.parse((await get('/replays/index.json')).body);
    expect(first.replays).toHaveLength(60);
    expect(first.older).toMatch(/^\d+_[A-Za-z0-9]{20}$/);
    const second = JSON.parse(
      (await get('/replays/index.json', { before: first.older })).body
    );
    expect(second.older).toBeUndefined();
    const ids = [...first.replays, ...second.replays].map(
      (r: { id: string }) => r.id
    );
    expect(new Set(ids).size).toBe(61);
    expect((await get('/replays')).body).toContain(
      `/replays?before=${first.older}`
    );
  });

  it('answers 410 for a removed replay, 404 for anything it does not serve', async () => {
    expect((await get(`/replays/${DOWN}`)).status).toBe(410);
    expect((await get(`/replays/${DOWN}/replay.json`)).status).toBe(410);
    for (const path of [
      '/replays/l_private',
      '/replays/NotARealIdButLong20x',
      `/replays/${UP}/other.json`,
      `/replays/${UP}/replay.json/more`,
      '/watch',
    ]) {
      expect((await get(path)).status).toBe(404);
    }
    expect((await handleSite(db, 'POST', '/replays', {})).status).toBe(405);
  });
});
