import type { TeamId, ClubId } from '@wolsok/feat-shared-basketball-data';
import type { MarkablePlayer } from '../lib/child';
import type { Selection } from '../lib/selection';
import { SELECTION_LIMITS } from '../lib/selection-lists';
import {
  SelectionFullError,
  SelectionTooNewError,
} from '../lib/selection-errors';
import { NotAColorError } from '../lib/club-colors';

/**
 * Where one adapter of `Auswahl` keeps its data, for `auswahlVertrag`: the
 * device's storage for the local adapter, one account's document for the
 * Firestore adapter (#2873).
 */
export interface SelectionStore {
  /**
   * A new adapter on this store, as after a reload. Resolves once the
   * adapter has read what is stored (`teams()` and `kinder()` are
   * defined).
   */
  open(): Promise<Selection>;
  /** Stores `dokument` as it is, as another app version or a fault might. */
  writeRaw(raw: unknown): Promise<void>;
  /** What is stored now, as it is. */
  readRaw(): Promise<unknown>;
  /**
   * Resolves once every open adapter has seen what was last written to the
   * store (a `storage` event, a snapshot). An adapter acts on what it has
   * seen: the order of two adapters' changes, or a change of an entry it
   * has not seen yet, holds only once it heard of the other's.
   */
  untilSettled(): Promise<void>;
}

/** Teams as stored, keyed by id, followed in the order given. */
const rawTeams = (...ids: readonly number[]) =>
  Object.fromEntries(ids.map((id, i) => [id, i + 1]));

/** Kinder as stored, keyed by person id, marked in the order given. */
const rawChildren = (
  ...kinder: readonly { personId: number; spitzname?: string }[]
) =>
  Object.fromEntries(
    kinder.map(({ personId, spitzname: nickname }, i) => [
      personId,
      { since: i + 1, ...(nickname && { nickname }) },
    ])
  );

/** Since when, as a write stamps it: some moment. */
const SOMETIME = expect.any(Number);

const MTV_WASBUETTEL: TeamId = 313036;
const MTV_GIFHORN: TeamId = 201500;
const SV_GROSS_OESINGEN: TeamId = 201765;
const TSV_MEINE: TeamId = 201234;

/** Vereine by their DBB id, of invented clubs. */
const CLUB_RED: ClubId = 4242;
const CLUB_BLUE: ClubId = 4343;

/** Named players, as a Kader gives them, of invented persons. */
const LUMI: MarkablePlayer = { kind: 'named', personId: 4711 };
const MORVO: MarkablePlayer = { kind: 'named', personId: 4712 };
const NELKA: MarkablePlayer = { kind: 'named', personId: 4713 };

/**
 * The behaviour every adapter of `Auswahl` shares. Each adapter's spec
 * runs it, with a fresh, empty store per test from `neuerSpeicher`.
 */
export function selectionContract(
  adapter: string,
  newStore: () => SelectionStore | Promise<SelectionStore>
): void {
  describe(`Auswahl (${adapter})`, () => {
    let store: SelectionStore;

    beforeEach(async () => {
      store = await newStore();
    });

    it('follows no Team at first', async () => {
      const selection = await store.open();

      expect(selection.teams()).toEqual([]);
    });

    it('follows Teams in the order they were followed', async () => {
      const selection = await store.open();

      await selection.follow(MTV_WASBUETTEL);
      await selection.follow(SV_GROSS_OESINGEN);
      await selection.follow(MTV_GIFHORN);

      expect(selection.teams()).toEqual([
        MTV_WASBUETTEL,
        SV_GROSS_OESINGEN,
        MTV_GIFHORN,
      ]);
    });

    it('follows a Team once, however often asked', async () => {
      const selection = await store.open();

      await selection.follow(MTV_WASBUETTEL);
      await selection.follow(MTV_GIFHORN);
      await selection.follow(MTV_WASBUETTEL);

      expect(selection.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('unfollows a Team and keeps the order of the others', async () => {
      const selection = await store.open();
      await selection.follow(MTV_WASBUETTEL);
      await selection.follow(SV_GROSS_OESINGEN);
      await selection.follow(MTV_GIFHORN);

      await selection.unfollow(SV_GROSS_OESINGEN);

      expect(selection.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('ignores unfollowing a Team it does not follow', async () => {
      const selection = await store.open();
      await selection.follow(MTV_WASBUETTEL);

      await selection.unfollow(MTV_GIFHORN);

      expect(selection.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('keeps Meine Teams across a reload', async () => {
      const before = await store.open();
      await before.follow(MTV_GIFHORN);
      await before.follow(MTV_WASBUETTEL);

      const after = await store.open();

      expect(after.teams()).toEqual([MTV_GIFHORN, MTV_WASBUETTEL]);
    });

    it('keeps an unfollowed Team gone across a reload', async () => {
      const before = await store.open();
      await before.follow(MTV_GIFHORN);
      await before.follow(MTV_WASBUETTEL);
      await before.unfollow(MTV_GIFHORN);

      const after = await store.open();

      expect(after.teams()).toEqual([MTV_WASBUETTEL]);
    });

    describe('following a Team again at the place it was unfollowed from', () => {
      it('puts it back between the same Teams', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);
        await selection.follow(SV_GROSS_OESINGEN);
        await selection.follow(MTV_GIFHORN);

        const place = await selection.unfollow(SV_GROSS_OESINGEN);
        await selection.follow(SV_GROSS_OESINGEN, place);

        expect(selection.teams()).toEqual([
          MTV_WASBUETTEL,
          SV_GROSS_OESINGEN,
          MTV_GIFHORN,
        ]);
        const after = await store.open();
        expect(after.teams()).toEqual([
          MTV_WASBUETTEL,
          SV_GROSS_OESINGEN,
          MTV_GIFHORN,
        ]);
      });

      it('keeps a Team followed meanwhile after the others', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);
        await selection.follow(SV_GROSS_OESINGEN);
        await selection.follow(MTV_GIFHORN);

        const place = await selection.unfollow(SV_GROSS_OESINGEN);
        await selection.follow(TSV_MEINE);
        await selection.follow(SV_GROSS_OESINGEN, place);

        const expected = [
          MTV_WASBUETTEL,
          SV_GROSS_OESINGEN,
          MTV_GIFHORN,
          TSV_MEINE,
        ];
        expect(selection.teams()).toEqual(expected);
        expect((await store.open()).teams()).toEqual(expected);
      });

      it('puts a Team just followed back at the end, where it was', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);
        await selection.follow(MTV_GIFHORN);

        const place = await selection.unfollow(MTV_GIFHORN);
        await selection.follow(MTV_GIFHORN, place);

        expect(place).toBeDefined();
        expect(selection.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
      });

      it('gives no place for a Team it does not follow', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);

        expect(await selection.unfollow(MTV_GIFHORN)).toBeUndefined();
      });

      it('changes nothing for a Team followed again meanwhile', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);
        await selection.follow(MTV_GIFHORN);
        const place = await selection.unfollow(MTV_WASBUETTEL);
        await selection.follow(MTV_WASBUETTEL);

        await selection.follow(MTV_WASBUETTEL, place);

        expect(selection.teams()).toEqual([MTV_GIFHORN, MTV_WASBUETTEL]);
      });

      it('follows at the end again without the place', async () => {
        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);
        await selection.follow(MTV_GIFHORN);

        await selection.unfollow(MTV_WASBUETTEL);
        await selection.follow(MTV_WASBUETTEL);

        expect((await store.open()).teams()).toEqual([
          MTV_GIFHORN,
          MTV_WASBUETTEL,
        ]);
      });
    });

    it("keeps another instance's follow when it follows itself", async () => {
      const tabA = await store.open();
      const tabB = await store.open();

      await tabA.follow(MTV_WASBUETTEL);
      await store.untilSettled();
      await tabB.follow(MTV_GIFHORN);

      const after = await store.open();
      expect(after.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('unfollows a Team another instance followed since it opened', async () => {
      const tabA = await store.open();
      const tabB = await store.open();

      await tabA.follow(MTV_WASBUETTEL);
      await tabA.follow(MTV_GIFHORN);
      await store.untilSettled();
      await tabB.unfollow(MTV_WASBUETTEL);

      const after = await store.open();
      expect(after.teams()).toEqual([MTV_GIFHORN]);
    });

    it("shows another instance's change while open", async () => {
      const tabA = await store.open();
      const tabB = await store.open();

      await tabB.follow(MTV_GIFHORN);
      await store.untilSettled();

      expect(tabA.teams()).toEqual([MTV_GIFHORN]);
    });

    it('starts empty from a store holding no document, and follows again', async () => {
      await store.writeRaw({ teams: 'kaputt' });

      const selection = await store.open();
      expect(selection.teams()).toEqual([]);

      await selection.follow(MTV_WASBUETTEL);
      const after = await store.open();
      expect(after.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('keeps the fields it does not know, which a later version added', async () => {
      const later = { zweitesElternteil: true };
      await store.writeRaw({
        version: 3,
        teams: rawTeams(MTV_GIFHORN),
        children: {},
        eltern: later,
      });

      const selection = await store.open();
      await selection.follow(MTV_WASBUETTEL);
      await selection.mark(LUMI);

      expect(await store.readRaw()).toEqual({
        version: 3,
        teams: { [MTV_GIFHORN]: 1, [MTV_WASBUETTEL]: SOMETIME },
        children: { [LUMI.personId]: { since: SOMETIME } },
        eltern: later,
      });
    });

    it('reads Kinder stored without Teams, and keeps them when following', async () => {
      await store.writeRaw({
        version: 3,
        children: rawChildren({ personId: 4711 }),
      });
      const selection = await store.open();

      expect(selection.teams()).toEqual([]);
      expect(selection.children()).toEqual([{ personId: 4711 }]);

      await selection.follow(MTV_WASBUETTEL);
      expect(await store.readRaw()).toEqual({
        version: 3,
        teams: { [MTV_WASBUETTEL]: SOMETIME },
        children: rawChildren({ personId: 4711 }),
      });
    });

    it('reads Meine Teams stored before Kinder joined, with no Kind', async () => {
      await store.writeRaw({ version: 3, teams: rawTeams(MTV_GIFHORN) });

      const selection = await store.open();

      expect(selection.teams()).toEqual([MTV_GIFHORN]);
      expect(selection.children()).toEqual([]);
    });

    it.each([
      ['no map', 4711],
      ['a Kind not marked since a time', { 4711: { nickname: 'Mimi' } }],
      ['a Kind that is no map', { 4711: 1 }],
      ['a person id that is text', { Mimi: { since: 1 } }],
      ['a person id of 0', { 0: { since: 1 } }],
      ['a negative person id', { '-1': { since: 1 } }],
      ['a person id with a fraction', { '1.5': { since: 1 } }],
      [
        'a person id beyond the safe integers',
        { [Number.MAX_SAFE_INTEGER + 1]: { since: 1 } },
      ],
      ['a Spitzname that is no text', { 4711: { since: 1, nickname: 7 } }],
    ])(
      'keeps Meine Teams and has no Kind where the Kinder are %s',
      async (_case, kinder) => {
        await store.writeRaw({
          version: 3,
          teams: rawTeams(MTV_GIFHORN),
          children: kinder,
        });

        const selection = await store.open();

        expect(selection.teams()).toEqual([MTV_GIFHORN]);
        expect(selection.children()).toEqual([]);
      }
    );

    it('keeps the readable Kinder where one entry is malformed', async () => {
      await store.writeRaw({
        version: 3,
        teams: rawTeams(MTV_GIFHORN),
        children: {
          [LUMI.personId]: { since: 1 },
          kaputt: { since: 2 },
          [MORVO.personId]: { since: 3, nickname: 'Mo' },
        },
      });

      const selection = await store.open();

      expect(selection.children()).toEqual([
        { personId: LUMI.personId },
        { personId: MORVO.personId, nickname: 'Mo' },
      ]);
    });

    it.each([
      ['a malformed entry', { 4711: { since: 1 }, kaputt: { since: 2 } }],
      ['no map', 'kaputt'],
    ])(
      'leaves Kinder with %s as stored when Meine Teams change',
      async (_case, kinder) => {
        await store.writeRaw({
          version: 3,
          teams: rawTeams(MTV_GIFHORN),
          children: kinder,
        });

        const selection = await store.open();
        await selection.follow(MTV_WASBUETTEL);

        expect(await store.readRaw()).toEqual({
          version: 3,
          teams: { [MTV_GIFHORN]: 1, [MTV_WASBUETTEL]: SOMETIME },
          children: kinder,
        });
      }
    );

    it('stores only the person id and the Spitzname of a Kind', async () => {
      const selection = await store.open();
      const player = {
        ...LUMI,
        firstName: 'Lumi',
        lastName: 'Ahornwiese',
        shirtNumber: '7',
      };

      await selection.mark(player, 'Mimi');

      expect(await store.readRaw()).toEqual({
        version: 3,
        children: { [LUMI.personId]: { since: SOMETIME, nickname: 'Mimi' } },
      });
    });

    describe('Kinder', () => {
      it('marks no Kind at first', async () => {
        const selection = await store.open();

        expect(selection.children()).toEqual([]);
      });

      it('marks Kinder in the order they were marked, a Spitzname kept', async () => {
        const selection = await store.open();

        await selection.mark(MORVO);
        await selection.mark(LUMI, 'Mimi');

        expect(selection.children()).toEqual([
          { personId: MORVO.personId },
          { personId: LUMI.personId, nickname: 'Mimi' },
        ]);
      });

      it('marks a Kind once, its Spitzname kept, however often asked', async () => {
        const selection = await store.open();
        await selection.mark(LUMI, 'Mimi');
        await selection.mark(MORVO);

        await selection.mark(LUMI, 'Lu');

        expect(selection.children()).toEqual([
          { personId: LUMI.personId, nickname: 'Mimi' },
          { personId: MORVO.personId },
        ]);
      });

      it('trims a Spitzname, takes an empty one for none and cuts a long one', async () => {
        const selection = await store.open();

        await selection.mark(LUMI, '  Mimi  ');
        await selection.mark(MORVO, '   ');
        await selection.mark(NELKA, 'N'.repeat(40));

        expect(selection.children()).toEqual([
          { personId: LUMI.personId, nickname: 'Mimi' },
          { personId: MORVO.personId },
          { personId: NELKA.personId, nickname: 'N'.repeat(30) },
        ]);
      });

      it('changes a Spitzname and keeps the Kind in its place', async () => {
        const selection = await store.open();
        await selection.mark(LUMI, 'Mimi');
        await selection.mark(MORVO);

        await selection.setNickname(LUMI.personId, 'Lu');
        await selection.setNickname(MORVO.personId, 'Mo');

        expect(selection.children()).toEqual([
          { personId: LUMI.personId, nickname: 'Lu' },
          { personId: MORVO.personId, nickname: 'Mo' },
        ]);
      });

      it('takes a Spitzname away', async () => {
        const selection = await store.open();
        await selection.mark(LUMI, 'Mimi');

        await selection.setNickname(LUMI.personId, undefined);

        expect(selection.children()).toEqual([{ personId: LUMI.personId }]);
      });

      it('marks nobody by giving a Spitzname to a person not marked', async () => {
        const selection = await store.open();

        await selection.setNickname(LUMI.personId, 'Mimi');

        expect(selection.children()).toEqual([]);
      });

      it('unmarks a Kind and keeps the order of the others', async () => {
        const selection = await store.open();
        await selection.mark(LUMI);
        await selection.mark(MORVO);
        await selection.mark(NELKA);

        await selection.unmark(MORVO.personId);
        await selection.unmark(4799);

        expect(selection.children()).toEqual([
          { personId: LUMI.personId },
          { personId: NELKA.personId },
        ]);
      });

      it('keeps the Kinder and Meine Teams apart across a reload', async () => {
        const before = await store.open();
        await before.follow(MTV_WASBUETTEL);
        await before.mark(LUMI, 'Mimi');
        await before.mark(MORVO);
        await before.unmark(MORVO.personId);
        await before.unfollow(MTV_WASBUETTEL);

        const after = await store.open();

        expect(after.teams()).toEqual([]);
        expect(after.children()).toEqual([
          { personId: LUMI.personId, nickname: 'Mimi' },
        ]);
      });

      it("keeps another instance's Kind when it marks one itself", async () => {
        const tabA = await store.open();
        const tabB = await store.open();

        await tabA.mark(LUMI);
        await store.untilSettled();
        await tabB.mark(MORVO);
        await tabB.follow(MTV_GIFHORN);

        const after = await store.open();
        expect(after.children()).toEqual([
          { personId: LUMI.personId },
          { personId: MORVO.personId },
        ]);
        expect(after.teams()).toEqual([MTV_GIFHORN]);
      });

      it("keeps a Kind another instance unmarked when it changes the Kind's Spitzname", async () => {
        const tabA = await store.open();
        await tabA.mark(LUMI, 'Mimi');
        await tabA.mark(MORVO);
        const tabB = await store.open();

        await tabA.unmark(LUMI.personId);
        await tabB.setNickname(LUMI.personId, 'Lu');

        const after = await store.open();
        expect(after.children()).toEqual([{ personId: MORVO.personId }]);
      });

      it("shows another instance's Kind while open", async () => {
        const tabA = await store.open();
        const tabB = await store.open();

        await tabB.mark(LUMI, 'Mimi');
        await store.untilSettled();

        expect(tabA.children()).toEqual([
          { personId: LUMI.personId, nickname: 'Mimi' },
        ]);
      });

      it('marks nothing from a newer version and refuses every change of a Kind', async () => {
        const newer = {
          version: 99,
          teams: [],
          kinder: [{ personId: LUMI.personId }],
        };
        await store.writeRaw(newer);

        const selection = await store.open();
        expect(selection.children()).toEqual([]);
        await expect(selection.mark(MORVO)).rejects.toBeInstanceOf(
          SelectionTooNewError
        );
        await expect(
          selection.setNickname(LUMI.personId, 'Mimi')
        ).rejects.toBeInstanceOf(SelectionTooNewError);
        await expect(selection.unmark(LUMI.personId)).rejects.toBeInstanceOf(
          SelectionTooNewError
        );

        expect(await store.readRaw()).toEqual(newer);
      });
    });

    describe('Vereinsfarben', () => {
      it('holds no colours at first', async () => {
        const selection = await store.open();

        expect(selection.clubColors()).toEqual([]);
      });

      it("keeps a Verein's colours in lower case across a reload, and only them", async () => {
        const selection = await store.open();

        await selection.setClubColors(CLUB_RED, {
          primary: '#C8102E',
          secondary: '#1d4ed8',
        });

        const expected = [
          { clubId: CLUB_RED, primary: '#c8102e', secondary: '#1d4ed8' },
        ];
        expect(selection.clubColors()).toEqual(expected);
        expect((await store.open()).clubColors()).toEqual(expected);
        expect(await store.readRaw()).toEqual({
          version: 3,
          clubColors: {
            [CLUB_RED]: '#c8102e,#1d4ed8',
          },
        });
      });

      it("replaces a Verein's colours, a second colour left out dropped", async () => {
        const selection = await store.open();
        await selection.setClubColors(CLUB_RED, {
          primary: '#c8102e',
          secondary: '#1d4ed8',
        });

        await selection.setClubColors(CLUB_RED, { primary: '#007a3d' });

        expect((await store.open()).clubColors()).toEqual([
          { clubId: CLUB_RED, primary: '#007a3d' },
        ]);
      });

      it("resets a Verein's colours and keeps the others' and Meine Teams", async () => {
        const selection = await store.open();
        await selection.follow(MTV_GIFHORN);
        await selection.setClubColors(CLUB_RED, { primary: '#c8102e' });
        await selection.setClubColors(CLUB_BLUE, { primary: '#1d4ed8' });

        await selection.resetClubColors(CLUB_RED);
        await selection.resetClubColors(CLUB_RED);

        const after = await store.open();
        expect(after.clubColors()).toEqual([
          { clubId: CLUB_BLUE, primary: '#1d4ed8' },
        ]);
        expect(after.teams()).toEqual([MTV_GIFHORN]);
      });

      it('refuses what is no #rrggbb colour, and stores nothing', async () => {
        const selection = await store.open();

        await expect(
          selection.setClubColors(CLUB_RED, { primary: 'red' })
        ).rejects.toBeInstanceOf(NotAColorError);
        await expect(
          selection.setClubColors(CLUB_RED, {
            primary: '#c8102e',
            secondary: '#12',
          })
        ).rejects.toBeInstanceOf(NotAColorError);

        expect(selection.clubColors()).toEqual([]);
        expect((await store.open()).clubColors()).toEqual([]);
      });

      it("keeps another instance's colours when it sets its own", async () => {
        const tabA = await store.open();
        const tabB = await store.open();

        await tabA.setClubColors(CLUB_RED, { primary: '#c8102e' });
        await store.untilSettled();
        await tabB.setClubColors(CLUB_BLUE, { primary: '#1d4ed8' });

        expect((await store.open()).clubColors()).toEqual([
          { clubId: CLUB_RED, primary: '#c8102e' },
          { clubId: CLUB_BLUE, primary: '#1d4ed8' },
        ]);
      });

      it("shows another instance's colours while open", async () => {
        const tabA = await store.open();
        const tabB = await store.open();

        await tabB.setClubColors(CLUB_RED, { primary: '#c8102e' });
        await store.untilSettled();

        expect(tabA.clubColors()).toEqual([
          { clubId: CLUB_RED, primary: '#c8102e' },
        ]);
      });

      it('keeps the readable colours where one entry is malformed', async () => {
        await store.writeRaw({
          version: 3,
          teams: rawTeams(MTV_GIFHORN),
          clubColors: {
            [CLUB_RED]: '#c8102e',
            [CLUB_BLUE]: 'blau',
          },
        });

        const selection = await store.open();

        expect(selection.clubColors()).toEqual([
          { clubId: CLUB_RED, primary: '#c8102e' },
        ]);
        expect(selection.teams()).toEqual([MTV_GIFHORN]);
      });

      it('sets no colours from a newer version', async () => {
        const newer = {
          version: 99,
          clubColors: { [CLUB_RED]: '#c8102e' },
        };
        await store.writeRaw(newer);

        const selection = await store.open();
        expect(selection.clubColors()).toEqual([]);
        await expect(
          selection.setClubColors(CLUB_BLUE, { primary: '#1d4ed8' })
        ).rejects.toBeInstanceOf(SelectionTooNewError);
        await expect(
          selection.resetClubColors(CLUB_RED)
        ).rejects.toBeInstanceOf(SelectionTooNewError);

        expect(await store.readRaw()).toEqual(newer);
      });
    });

    describe('caps', () => {
      const ids = (count: number) =>
        Array.from({ length: count }, (_, i) => 1000 + i);

      it('refuses to follow one Team more than its cap, and stores nothing', async () => {
        const full = ids(SELECTION_LIMITS.teams);
        await store.writeRaw({ version: 3, teams: rawTeams(...full) });
        const selection = await store.open();

        await expect(selection.follow(MTV_WASBUETTEL)).rejects.toEqual(
          new SelectionFullError('teams')
        );

        expect(selection.teams()).toEqual(full);
        expect(await store.readRaw()).toEqual({
          version: 3,
          teams: rawTeams(...full),
        });
      });

      it('refuses to mark one Kind more than its cap', async () => {
        const full = ids(SELECTION_LIMITS.children).map((personId) => ({
          personId,
        }));
        await store.writeRaw({
          version: 3,
          children: rawChildren(...full),
        });
        const selection = await store.open();

        await expect(selection.mark(LUMI)).rejects.toEqual(
          new SelectionFullError('children')
        );

        expect(selection.children()).toEqual(full);
      });

      it("refuses one Verein's colours more than their cap", async () => {
        const full = ids(SELECTION_LIMITS.clubColors);
        await store.writeRaw({
          version: 3,
          clubColors: Object.fromEntries(full.map((id) => [id, '#c8102e'])),
        });
        const selection = await store.open();

        await expect(
          selection.setClubColors(CLUB_RED, { primary: '#1d4ed8' })
        ).rejects.toEqual(new SelectionFullError('clubColors'));
        // a Verein holding colours already may still change them
        await selection.setClubColors(full[0], { primary: '#1d4ed8' });

        expect(selection.clubColors()?.[0]).toEqual({
          clubId: full[0],
          primary: '#1d4ed8',
        });
        expect(selection.clubColors()).toHaveLength(full.length);
      });

      it('still unfollows where the stored Teams are over their cap', async () => {
        const tooMany = ids(SELECTION_LIMITS.teams + 1);
        await store.writeRaw({ version: 3, teams: rawTeams(...tooMany) });
        const selection = await store.open();

        await selection.unfollow(tooMany[0]);

        expect(selection.teams()).toEqual(tooMany.slice(1));
      });
    });

    it('follows nothing from a newer version and refuses to change it', async () => {
      const newer = { version: 99, teams: [MTV_GIFHORN], mehr: true };
      await store.writeRaw(newer);

      const selection = await store.open();
      expect(selection.teams()).toEqual([]);
      await expect(selection.follow(MTV_WASBUETTEL)).rejects.toBeInstanceOf(
        SelectionTooNewError
      );
      await expect(selection.unfollow(MTV_GIFHORN)).rejects.toBeInstanceOf(
        SelectionTooNewError
      );

      expect(selection.teams()).toEqual([]);
      expect(await store.readRaw()).toEqual(newer);
    });

    it('refuses once it heard a newer version wrote since it opened', async () => {
      const selection = await store.open();
      const newer = { version: 99, teams: [] };
      await store.writeRaw(newer);
      await store.untilSettled();

      await expect(selection.follow(MTV_WASBUETTEL)).rejects.toBeInstanceOf(
        SelectionTooNewError
      );
      expect(await store.readRaw()).toEqual(newer);
    });
  });
}
