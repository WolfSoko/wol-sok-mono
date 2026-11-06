import {
  FAKE_SERVER_TIME,
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
} from './fake-firebase-sdk';

/** Lets the promises queued so far run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('FakeFirebase', () => {
  let fake: FakeFirebase;
  let sdk: FakeFirebase['dbSdk'];

  beforeEach(() => {
    fake = new FakeFirebase();
    sdk = fake.dbSdk;
  });

  describe('paths and ids', () => {
    it('joins segments into a path, the last one its id', () => {
      expect(sdk.doc({}, 'players', 'ada', 'storage', 'key')).toMatchObject({
        path: 'players/ada/storage/key',
        id: 'key',
      });
      expect(sdk.doc({}, 'profiles/ada').id).toBe('ada');
    });

    it('names a document of a collection, or gives it an id of its own', () => {
      const queue = sdk.collection({}, 'queue');

      expect(sdk.doc(queue, 'ada').path).toBe('queue/ada');
      expect(sdk.doc(queue)).toMatchObject({
        path: 'queue/auto1',
        id: 'auto1',
      });
      expect(sdk.doc(queue).id).toBe('auto2');
    });
  });

  describe('the server time', () => {
    it('stores the server time as a timestamp, and logs the sentinel', async () => {
      fake = new FakeFirebase({ serverTime: 1_500 });

      await fake.dbSdk.setDoc(fake.dbSdk.doc({}, 'a/b'), {
        at: fake.dbSdk.serverTimestamp(),
      });

      expect(fake.docs.get('a/b')).toEqual({ at: new FakeTimestamp(1, 5e8) });
      expect(fake.docs.get('a/b')?.['at']).toBeInstanceOf(FakeTimestamp);
      expect(fake.writes).toEqual([
        { kind: 'set', path: 'a/b', data: { at: SERVER_TIMESTAMP } },
      ]);
    });

    it('defaults to a fixed time', () => {
      expect(new FakeFirebase().serverTime).toBe(FAKE_SERVER_TIME);
    });

    it('keeps the fraction of a millisecond, as the browser SDK does', () => {
      const stamp = FakeTimestamp.fromMillis(1_000.25);

      expect(stamp).toEqual(new FakeTimestamp(1, 250_000));
      expect(stamp.toMillis()).toBe(1_000.25);
    });
  });

  describe('writes', () => {
    it('merges only the fields named, each whole', async () => {
      fake.docs.set('p/ada', { name: 'Ada', avatar: { id: 1, x: 2 } });

      await sdk.setDoc(
        sdk.doc({}, 'p/ada'),
        { avatar: { id: 3 }, motto: 'Hi', ignored: true },
        { mergeFields: ['avatar', 'motto'] }
      );

      expect(fake.docs.get('p/ada')).toEqual({
        name: 'Ada',
        avatar: { id: 3 },
        motto: 'Hi',
      });
    });

    it('refuses to update a document that is not there', async () => {
      await expect(
        sdk.updateDoc(sdk.doc({}, 'p/none'), { a: 1 })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    it('commits a batch at once, and not before', async () => {
      const batch = sdk.writeBatch();
      batch.set(sdk.doc({}, 'a/1'), { n: 1 });
      batch.delete(sdk.doc({}, 'a/2'));
      expect(fake.writes).toEqual([]);

      await batch.commit();

      expect(fake.writes.map((write) => write.kind)).toEqual(['set', 'delete']);
      expect(fake.deleted()).toEqual(['a/2']);
    });

    it('refuses reads and writes of a refused path', async () => {
      fake.refused.add('a/1');
      const ref = sdk.doc({}, 'a/1');

      await expect(sdk.getDoc(ref)).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await expect(sdk.setDoc(ref, {})).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      fake.docs.set('r/a', {
        players: ['ada'],
        at: FakeTimestamp.fromMillis(1),
      });
      fake.docs.set('r/b', {
        players: ['bob'],
        at: FakeTimestamp.fromMillis(2),
      });
      fake.docs.set('r/c', {
        players: ['ada'],
        at: FakeTimestamp.fromMillis(3),
      });
      fake.docs.set('r/c/blob/data', { players: ['ada'] });
    });

    it('filters, orders and limits the direct children, and logs the query', async () => {
      const snapshot = await sdk.getDocs(
        sdk.query(
          sdk.collection({}, 'r'),
          sdk.where('players', 'array-contains', 'ada'),
          sdk.orderBy('at', 'desc'),
          sdk.limit(5)
        )
      );

      expect(snapshot.docs.map((doc) => doc.id)).toEqual(['c', 'a']);
      expect(fake.queries).toEqual([
        [
          'r',
          ['where', 'players', 'array-contains', 'ada'],
          ['orderBy', 'at', 'desc'],
          ['limit', 5],
        ],
      ]);
    });

    it('compares timestamps by their time', async () => {
      const snapshot = await sdk.getDocs(
        sdk.query(
          sdk.collection({}, 'r'),
          sdk.where('at', '>=', FakeTimestamp.fromMillis(2)),
          sdk.limit(1)
        )
      );

      expect(snapshot.docs.map((doc) => doc.id)).toEqual(['b']);
    });

    it('throws for an operator it does not know, rather than guess', () => {
      expect(() => sdk.where('a', 'not-in', [])).toThrow(/not-in/);
    });
  });

  describe('listeners', () => {
    it('tells a document at once and on each write, until stopped', async () => {
      const seen: unknown[] = [];
      const stop = sdk.onSnapshot(
        sdk.doc({}, 'a/1'),
        { includeMetadataChanges: true },
        (snapshot: { get(field: string): unknown }) =>
          seen.push(snapshot.get('n'))
      );

      await sdk.setDoc(sdk.doc({}, 'a/1'), { n: 1 });
      stop();
      await sdk.setDoc(sdk.doc({}, 'a/1'), { n: 2 });

      expect(seen).toEqual([undefined, 1]);
    });

    it("tells a collection of its children's changes", () => {
      const seen: string[][] = [];
      sdk.onSnapshot(
        sdk.collection({}, 'n'),
        (snapshot: { docs: { id: string }[] }) =>
          seen.push(snapshot.docs.map((doc) => doc.id))
      );

      fake.put('n/a', { x: 1 });
      fake.put('n/a/deeper/z', { x: 1 });
      fake.put('n/a', null);

      expect(seen).toEqual([[], ['a'], []]);
    });

    it('waits with a pending document until it is written', () => {
      fake.pending.add('a/1');
      const seen: unknown[] = [];
      sdk.onSnapshot(sdk.doc({}, 'a/1'), (snapshot: { exists(): boolean }) =>
        seen.push(snapshot.exists())
      );
      expect(seen).toEqual([]);

      fake.put('a/1', {});

      expect(seen).toEqual([true]);
    });

    it('tells a refused listener its error and nothing more', () => {
      fake.refused.add('a/1');
      const next = jest.fn();
      const error = jest.fn();

      sdk.onSnapshot(sdk.doc({}, 'a/1'), next, error);
      fake.refused.delete('a/1');
      fake.put('a/1', {});

      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'permission-denied' })
      );
    });

    it('tells everyone again on a resend, with the cache flag', () => {
      const flags: boolean[] = [];
      sdk.onSnapshot(
        sdk.doc({}, 'a/1'),
        (snapshot: { metadata: { fromCache: boolean } }) =>
          flags.push(snapshot.metadata.fromCache)
      );

      fake.fromCache = true;
      fake.resend();

      expect(flags).toEqual([false, true]);
    });

    it('tells the Realtime Database values, and gives no database on request', () => {
      const values: unknown[] = [];
      fake.rtdbSdk.onValue(fake.rtdbSdk.ref({}, 'bans/ada'), (snapshot) =>
        values.push(snapshot.val())
      );

      fake.putValue('bans/ada', 0);

      expect(values).toEqual([null, 0]);
      expect(fake.listened).toEqual(['rtdb:bans/ada']);
      expect(fake.connection({ rtdb: false }).rtdb).toBeNull();
    });
  });

  describe('transactions', () => {
    const ref = () => fake.dbSdk.doc({}, 'a/1');

    it('applies its writes only once its function resolved, and answers it', async () => {
      const answer = await sdk.runTransaction({}, async (transaction) => {
        const t = transaction as {
          get(ref: unknown): Promise<{ exists(): boolean }>;
          set(ref: unknown, data: object): void;
        };
        t.set(ref(), { n: 1 });
        expect(fake.writes).toEqual([]);
        return (await t.get(ref())).exists();
      });

      expect(answer).toBe(false);
      expect(fake.docs.get('a/1')).toEqual({ n: 1 });
    });

    it('writes nothing when its function throws', async () => {
      await expect(
        sdk.runTransaction({}, async (transaction) => {
          (transaction as { set(ref: unknown, data: object): void }).set(
            ref(),
            { n: 1 }
          );
          throw new Error('no');
        })
      ).rejects.toThrow('no');
      expect(fake.writes).toEqual([]);
    });

    it('fails offline with unavailable, and on a refused path', async () => {
      fake.offline = true;
      await expect(
        sdk.runTransaction({}, async () => undefined)
      ).rejects.toMatchObject({ code: 'unavailable' });

      fake.offline = false;
      fake.refused.add('a/1');
      await expect(
        sdk.runTransaction({}, async (transaction) =>
          (transaction as { get(ref: unknown): Promise<unknown> }).get(ref())
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('hangs, or commits without an answer, when switched to', async () => {
      const answered = jest.fn();
      fake.hanging = true;
      void sdk.runTransaction({}, async () => undefined).then(answered);
      await settle();
      expect(answered).not.toHaveBeenCalled();

      fake.hanging = false;
      fake.lateCommit = true;
      void sdk
        .runTransaction({}, async (transaction) =>
          (transaction as { set(ref: unknown, data: object): void }).set(
            ref(),
            { n: 1 }
          )
        )
        .then(answered);
      await settle();
      expect(answered).not.toHaveBeenCalled();
      expect(fake.docs.get('a/1')).toEqual({ n: 1 });
    });

    it('lets reads hang, when switched to', async () => {
      const answered = jest.fn();
      fake.hangingReads = true;
      void sdk.getDoc(ref()).then(answered);
      await settle();

      expect(answered).not.toHaveBeenCalled();
    });
  });
});
