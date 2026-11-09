import type { TeamId, VereinId } from '@wolsok/feat-shared-basketball-data';
import type { MarkierbarerSpieler } from '../kind';
import type { Auswahl } from '../auswahl';
import { AUSWAHL_GRENZEN } from '../auswahl-dokument';
import { AuswahlVollError, AuswahlZuNeuError } from '../auswahl-fehler';
import { KeineFarbeError } from '../../vereinsfarben/vereinsfarben';

/**
 * Where one adapter of `Auswahl` keeps its data, for `auswahlVertrag`: the
 * device's storage for the local adapter, one account's document for the
 * Firestore adapter (#2873).
 */
export interface AuswahlSpeicher {
  /**
   * A new adapter on this store, as after a reload. Resolves once the
   * adapter has read what is stored (`teams()` and `kinder()` are
   * defined).
   */
  oeffnen(): Promise<Auswahl>;
  /** Stores `dokument` as it is, as another app version or a fault might. */
  schreibeRoh(dokument: unknown): Promise<void>;
  /** What is stored now, as it is. */
  liesRoh(): Promise<unknown>;
  /**
   * Resolves once every open adapter has seen what was last written to the
   * store (a `storage` event, a snapshot). An adapter acts on what it has
   * seen: the order of two adapters' changes, or a change of an entry it
   * has not seen yet, holds only once it heard of the other's.
   */
  bisStabil(): Promise<void>;
}

/** Teams as stored, keyed by id, followed in the order given. */
const teamsRoh = (...ids: readonly number[]) =>
  Object.fromEntries(ids.map((id, i) => [id, i + 1]));

/** Kinder as stored, keyed by person id, marked in the order given. */
const kinderRoh = (
  ...kinder: readonly { personId: number; spitzname?: string }[]
) =>
  Object.fromEntries(
    kinder.map(({ personId, spitzname }, i) => [
      personId,
      { seit: i + 1, ...(spitzname && { spitzname }) },
    ])
  );

/** Since when, as a write stamps it: some moment. */
const IRGENDWANN = expect.any(Number);

const MTV_WASBUETTEL: TeamId = 313036;
const MTV_GIFHORN: TeamId = 201500;
const SV_GROSS_OESINGEN: TeamId = 201765;

/** Vereine by their DBB id, of invented clubs. */
const VEREIN_ROT: VereinId = 4242;
const VEREIN_BLAU: VereinId = 4343;

/** Named players, as a Kader gives them, of invented persons. */
const LUMI: MarkierbarerSpieler = { art: 'benannt', personId: 4711 };
const MORVO: MarkierbarerSpieler = { art: 'benannt', personId: 4712 };
const NELKA: MarkierbarerSpieler = { art: 'benannt', personId: 4713 };

/**
 * The behaviour every adapter of `Auswahl` shares. Each adapter's spec
 * runs it, with a fresh, empty store per test from `neuerSpeicher`.
 */
export function auswahlVertrag(
  adapter: string,
  neuerSpeicher: () => AuswahlSpeicher | Promise<AuswahlSpeicher>
): void {
  describe(`Auswahl (${adapter})`, () => {
    let speicher: AuswahlSpeicher;

    beforeEach(async () => {
      speicher = await neuerSpeicher();
    });

    it('follows no Team at first', async () => {
      const auswahl = await speicher.oeffnen();

      expect(auswahl.teams()).toEqual([]);
    });

    it('follows Teams in the order they were followed', async () => {
      const auswahl = await speicher.oeffnen();

      await auswahl.folgen(MTV_WASBUETTEL);
      await auswahl.folgen(SV_GROSS_OESINGEN);
      await auswahl.folgen(MTV_GIFHORN);

      expect(auswahl.teams()).toEqual([
        MTV_WASBUETTEL,
        SV_GROSS_OESINGEN,
        MTV_GIFHORN,
      ]);
    });

    it('follows a Team once, however often asked', async () => {
      const auswahl = await speicher.oeffnen();

      await auswahl.folgen(MTV_WASBUETTEL);
      await auswahl.folgen(MTV_GIFHORN);
      await auswahl.folgen(MTV_WASBUETTEL);

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('unfollows a Team and keeps the order of the others', async () => {
      const auswahl = await speicher.oeffnen();
      await auswahl.folgen(MTV_WASBUETTEL);
      await auswahl.folgen(SV_GROSS_OESINGEN);
      await auswahl.folgen(MTV_GIFHORN);

      await auswahl.entfolgen(SV_GROSS_OESINGEN);

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('ignores unfollowing a Team it does not follow', async () => {
      const auswahl = await speicher.oeffnen();
      await auswahl.folgen(MTV_WASBUETTEL);

      await auswahl.entfolgen(MTV_GIFHORN);

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('keeps Meine Teams across a reload', async () => {
      const vorher = await speicher.oeffnen();
      await vorher.folgen(MTV_GIFHORN);
      await vorher.folgen(MTV_WASBUETTEL);

      const nachher = await speicher.oeffnen();

      expect(nachher.teams()).toEqual([MTV_GIFHORN, MTV_WASBUETTEL]);
    });

    it('keeps an unfollowed Team gone across a reload', async () => {
      const vorher = await speicher.oeffnen();
      await vorher.folgen(MTV_GIFHORN);
      await vorher.folgen(MTV_WASBUETTEL);
      await vorher.entfolgen(MTV_GIFHORN);

      const nachher = await speicher.oeffnen();

      expect(nachher.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it("keeps another instance's follow when it follows itself", async () => {
      const tabA = await speicher.oeffnen();
      const tabB = await speicher.oeffnen();

      await tabA.folgen(MTV_WASBUETTEL);
      await speicher.bisStabil();
      await tabB.folgen(MTV_GIFHORN);

      const nachher = await speicher.oeffnen();
      expect(nachher.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('unfollows a Team another instance followed since it opened', async () => {
      const tabA = await speicher.oeffnen();
      const tabB = await speicher.oeffnen();

      await tabA.folgen(MTV_WASBUETTEL);
      await tabA.folgen(MTV_GIFHORN);
      await speicher.bisStabil();
      await tabB.entfolgen(MTV_WASBUETTEL);

      const nachher = await speicher.oeffnen();
      expect(nachher.teams()).toEqual([MTV_GIFHORN]);
    });

    it("shows another instance's change while open", async () => {
      const tabA = await speicher.oeffnen();
      const tabB = await speicher.oeffnen();

      await tabB.folgen(MTV_GIFHORN);
      await speicher.bisStabil();

      expect(tabA.teams()).toEqual([MTV_GIFHORN]);
    });

    it('starts empty from a store holding no document, and follows again', async () => {
      await speicher.schreibeRoh({ teams: 'kaputt' });

      const auswahl = await speicher.oeffnen();
      expect(auswahl.teams()).toEqual([]);

      await auswahl.folgen(MTV_WASBUETTEL);
      const nachher = await speicher.oeffnen();
      expect(nachher.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('keeps the fields it does not know, which a later version added', async () => {
      const eltern = { zweitesElternteil: true };
      await speicher.schreibeRoh({
        version: 2,
        teams: teamsRoh(MTV_GIFHORN),
        kinder: {},
        eltern,
      });

      const auswahl = await speicher.oeffnen();
      await auswahl.folgen(MTV_WASBUETTEL);
      await auswahl.markieren(LUMI);

      expect(await speicher.liesRoh()).toEqual({
        version: 2,
        teams: { [MTV_GIFHORN]: 1, [MTV_WASBUETTEL]: IRGENDWANN },
        kinder: { [LUMI.personId]: { seit: IRGENDWANN } },
        eltern,
      });
    });

    it('reads Kinder stored without Teams, and keeps them when following', async () => {
      await speicher.schreibeRoh({
        version: 2,
        kinder: kinderRoh({ personId: 4711 }),
      });
      const auswahl = await speicher.oeffnen();

      expect(auswahl.teams()).toEqual([]);
      expect(auswahl.kinder()).toEqual([{ personId: 4711 }]);

      await auswahl.folgen(MTV_WASBUETTEL);
      expect(await speicher.liesRoh()).toEqual({
        version: 2,
        teams: { [MTV_WASBUETTEL]: IRGENDWANN },
        kinder: kinderRoh({ personId: 4711 }),
      });
    });

    it('reads Meine Teams stored before Kinder joined, with no Kind', async () => {
      await speicher.schreibeRoh({ version: 2, teams: teamsRoh(MTV_GIFHORN) });

      const auswahl = await speicher.oeffnen();

      expect(auswahl.teams()).toEqual([MTV_GIFHORN]);
      expect(auswahl.kinder()).toEqual([]);
    });

    it.each([
      ['no map', 4711],
      ['a Kind not marked since a time', { 4711: { spitzname: 'Mimi' } }],
      ['a Kind that is no map', { 4711: 1 }],
      ['a person id that is text', { Mimi: { seit: 1 } }],
      ['a person id of 0', { 0: { seit: 1 } }],
      ['a negative person id', { '-1': { seit: 1 } }],
      ['a person id with a fraction', { '1.5': { seit: 1 } }],
      [
        'a person id beyond the safe integers',
        { [Number.MAX_SAFE_INTEGER + 1]: { seit: 1 } },
      ],
      ['a Spitzname that is no text', { 4711: { seit: 1, spitzname: 7 } }],
    ])(
      'keeps Meine Teams and has no Kind where the Kinder are %s',
      async (_fall, kinder) => {
        await speicher.schreibeRoh({
          version: 2,
          teams: teamsRoh(MTV_GIFHORN),
          kinder,
        });

        const auswahl = await speicher.oeffnen();

        expect(auswahl.teams()).toEqual([MTV_GIFHORN]);
        expect(auswahl.kinder()).toEqual([]);
      }
    );

    it('keeps the readable Kinder where one entry is malformed', async () => {
      await speicher.schreibeRoh({
        version: 2,
        teams: teamsRoh(MTV_GIFHORN),
        kinder: {
          [LUMI.personId]: { seit: 1 },
          kaputt: { seit: 2 },
          [MORVO.personId]: { seit: 3, spitzname: 'Mo' },
        },
      });

      const auswahl = await speicher.oeffnen();

      expect(auswahl.kinder()).toEqual([
        { personId: LUMI.personId },
        { personId: MORVO.personId, spitzname: 'Mo' },
      ]);
    });

    it.each([
      ['a malformed entry', { 4711: { seit: 1 }, kaputt: { seit: 2 } }],
      ['no map', 'kaputt'],
    ])(
      'leaves Kinder with %s as stored when Meine Teams change',
      async (_fall, kinder) => {
        await speicher.schreibeRoh({
          version: 2,
          teams: teamsRoh(MTV_GIFHORN),
          kinder,
        });

        const auswahl = await speicher.oeffnen();
        await auswahl.folgen(MTV_WASBUETTEL);

        expect(await speicher.liesRoh()).toEqual({
          version: 2,
          teams: { [MTV_GIFHORN]: 1, [MTV_WASBUETTEL]: IRGENDWANN },
          kinder,
        });
      }
    );

    it('stores only the person id and the Spitzname of a Kind', async () => {
      const auswahl = await speicher.oeffnen();
      const spieler = {
        ...LUMI,
        vorname: 'Lumi',
        nachname: 'Ahornwiese',
        trikotnummer: '7',
      };

      await auswahl.markieren(spieler, 'Mimi');

      expect(await speicher.liesRoh()).toEqual({
        version: 2,
        kinder: { [LUMI.personId]: { seit: IRGENDWANN, spitzname: 'Mimi' } },
      });
    });

    describe('Kinder', () => {
      it('marks no Kind at first', async () => {
        const auswahl = await speicher.oeffnen();

        expect(auswahl.kinder()).toEqual([]);
      });

      it('marks Kinder in the order they were marked, a Spitzname kept', async () => {
        const auswahl = await speicher.oeffnen();

        await auswahl.markieren(MORVO);
        await auswahl.markieren(LUMI, 'Mimi');

        expect(auswahl.kinder()).toEqual([
          { personId: MORVO.personId },
          { personId: LUMI.personId, spitzname: 'Mimi' },
        ]);
      });

      it('marks a Kind once, its Spitzname kept, however often asked', async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.markieren(LUMI, 'Mimi');
        await auswahl.markieren(MORVO);

        await auswahl.markieren(LUMI, 'Lu');

        expect(auswahl.kinder()).toEqual([
          { personId: LUMI.personId, spitzname: 'Mimi' },
          { personId: MORVO.personId },
        ]);
      });

      it('trims a Spitzname, takes an empty one for none and cuts a long one', async () => {
        const auswahl = await speicher.oeffnen();

        await auswahl.markieren(LUMI, '  Mimi  ');
        await auswahl.markieren(MORVO, '   ');
        await auswahl.markieren(NELKA, 'N'.repeat(40));

        expect(auswahl.kinder()).toEqual([
          { personId: LUMI.personId, spitzname: 'Mimi' },
          { personId: MORVO.personId },
          { personId: NELKA.personId, spitzname: 'N'.repeat(30) },
        ]);
      });

      it('changes a Spitzname and keeps the Kind in its place', async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.markieren(LUMI, 'Mimi');
        await auswahl.markieren(MORVO);

        await auswahl.spitznameSetzen(LUMI.personId, 'Lu');
        await auswahl.spitznameSetzen(MORVO.personId, 'Mo');

        expect(auswahl.kinder()).toEqual([
          { personId: LUMI.personId, spitzname: 'Lu' },
          { personId: MORVO.personId, spitzname: 'Mo' },
        ]);
      });

      it('takes a Spitzname away', async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.markieren(LUMI, 'Mimi');

        await auswahl.spitznameSetzen(LUMI.personId, undefined);

        expect(auswahl.kinder()).toEqual([{ personId: LUMI.personId }]);
      });

      it('marks nobody by giving a Spitzname to a person not marked', async () => {
        const auswahl = await speicher.oeffnen();

        await auswahl.spitznameSetzen(LUMI.personId, 'Mimi');

        expect(auswahl.kinder()).toEqual([]);
      });

      it('unmarks a Kind and keeps the order of the others', async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.markieren(LUMI);
        await auswahl.markieren(MORVO);
        await auswahl.markieren(NELKA);

        await auswahl.entmarkieren(MORVO.personId);
        await auswahl.entmarkieren(4799);

        expect(auswahl.kinder()).toEqual([
          { personId: LUMI.personId },
          { personId: NELKA.personId },
        ]);
      });

      it('keeps the Kinder and Meine Teams apart across a reload', async () => {
        const vorher = await speicher.oeffnen();
        await vorher.folgen(MTV_WASBUETTEL);
        await vorher.markieren(LUMI, 'Mimi');
        await vorher.markieren(MORVO);
        await vorher.entmarkieren(MORVO.personId);
        await vorher.entfolgen(MTV_WASBUETTEL);

        const nachher = await speicher.oeffnen();

        expect(nachher.teams()).toEqual([]);
        expect(nachher.kinder()).toEqual([
          { personId: LUMI.personId, spitzname: 'Mimi' },
        ]);
      });

      it("keeps another instance's Kind when it marks one itself", async () => {
        const tabA = await speicher.oeffnen();
        const tabB = await speicher.oeffnen();

        await tabA.markieren(LUMI);
        await speicher.bisStabil();
        await tabB.markieren(MORVO);
        await tabB.folgen(MTV_GIFHORN);

        const nachher = await speicher.oeffnen();
        expect(nachher.kinder()).toEqual([
          { personId: LUMI.personId },
          { personId: MORVO.personId },
        ]);
        expect(nachher.teams()).toEqual([MTV_GIFHORN]);
      });

      it("keeps a Kind another instance unmarked when it changes the Kind's Spitzname", async () => {
        const tabA = await speicher.oeffnen();
        await tabA.markieren(LUMI, 'Mimi');
        await tabA.markieren(MORVO);
        const tabB = await speicher.oeffnen();

        await tabA.entmarkieren(LUMI.personId);
        await tabB.spitznameSetzen(LUMI.personId, 'Lu');

        const nachher = await speicher.oeffnen();
        expect(nachher.kinder()).toEqual([{ personId: MORVO.personId }]);
      });

      it("shows another instance's Kind while open", async () => {
        const tabA = await speicher.oeffnen();
        const tabB = await speicher.oeffnen();

        await tabB.markieren(LUMI, 'Mimi');
        await speicher.bisStabil();

        expect(tabA.kinder()).toEqual([
          { personId: LUMI.personId, spitzname: 'Mimi' },
        ]);
      });

      it('marks nothing from a newer version and refuses every change of a Kind', async () => {
        const neuer = {
          version: 99,
          teams: [],
          kinder: [{ personId: LUMI.personId }],
        };
        await speicher.schreibeRoh(neuer);

        const auswahl = await speicher.oeffnen();
        expect(auswahl.kinder()).toEqual([]);
        await expect(auswahl.markieren(MORVO)).rejects.toBeInstanceOf(
          AuswahlZuNeuError
        );
        await expect(
          auswahl.spitznameSetzen(LUMI.personId, 'Mimi')
        ).rejects.toBeInstanceOf(AuswahlZuNeuError);
        await expect(
          auswahl.entmarkieren(LUMI.personId)
        ).rejects.toBeInstanceOf(AuswahlZuNeuError);

        expect(await speicher.liesRoh()).toEqual(neuer);
      });
    });

    describe('Vereinsfarben', () => {
      it('holds no colours at first', async () => {
        const auswahl = await speicher.oeffnen();

        expect(auswahl.vereinsfarben()).toEqual([]);
      });

      it("keeps a Verein's colours in lower case across a reload, and only them", async () => {
        const auswahl = await speicher.oeffnen();

        await auswahl.vereinsfarbenSetzen(VEREIN_ROT, {
          primaer: '#C8102E',
          zweite: '#1d4ed8',
        });

        const erwartet = [
          { vereinId: VEREIN_ROT, primaer: '#c8102e', zweite: '#1d4ed8' },
        ];
        expect(auswahl.vereinsfarben()).toEqual(erwartet);
        expect((await speicher.oeffnen()).vereinsfarben()).toEqual(erwartet);
        expect(await speicher.liesRoh()).toEqual({
          version: 2,
          vereinsfarben: {
            [VEREIN_ROT]: '#c8102e,#1d4ed8',
          },
        });
      });

      it("replaces a Verein's colours, a second colour left out dropped", async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.vereinsfarbenSetzen(VEREIN_ROT, {
          primaer: '#c8102e',
          zweite: '#1d4ed8',
        });

        await auswahl.vereinsfarbenSetzen(VEREIN_ROT, { primaer: '#007a3d' });

        expect((await speicher.oeffnen()).vereinsfarben()).toEqual([
          { vereinId: VEREIN_ROT, primaer: '#007a3d' },
        ]);
      });

      it("resets a Verein's colours and keeps the others' and Meine Teams", async () => {
        const auswahl = await speicher.oeffnen();
        await auswahl.folgen(MTV_GIFHORN);
        await auswahl.vereinsfarbenSetzen(VEREIN_ROT, { primaer: '#c8102e' });
        await auswahl.vereinsfarbenSetzen(VEREIN_BLAU, { primaer: '#1d4ed8' });

        await auswahl.vereinsfarbenZuruecksetzen(VEREIN_ROT);
        await auswahl.vereinsfarbenZuruecksetzen(VEREIN_ROT);

        const nachher = await speicher.oeffnen();
        expect(nachher.vereinsfarben()).toEqual([
          { vereinId: VEREIN_BLAU, primaer: '#1d4ed8' },
        ]);
        expect(nachher.teams()).toEqual([MTV_GIFHORN]);
      });

      it('refuses what is no #rrggbb colour, and stores nothing', async () => {
        const auswahl = await speicher.oeffnen();

        await expect(
          auswahl.vereinsfarbenSetzen(VEREIN_ROT, { primaer: 'red' })
        ).rejects.toBeInstanceOf(KeineFarbeError);
        await expect(
          auswahl.vereinsfarbenSetzen(VEREIN_ROT, {
            primaer: '#c8102e',
            zweite: '#12',
          })
        ).rejects.toBeInstanceOf(KeineFarbeError);

        expect(auswahl.vereinsfarben()).toEqual([]);
        expect((await speicher.oeffnen()).vereinsfarben()).toEqual([]);
      });

      it("keeps another instance's colours when it sets its own", async () => {
        const tabA = await speicher.oeffnen();
        const tabB = await speicher.oeffnen();

        await tabA.vereinsfarbenSetzen(VEREIN_ROT, { primaer: '#c8102e' });
        await speicher.bisStabil();
        await tabB.vereinsfarbenSetzen(VEREIN_BLAU, { primaer: '#1d4ed8' });

        expect((await speicher.oeffnen()).vereinsfarben()).toEqual([
          { vereinId: VEREIN_ROT, primaer: '#c8102e' },
          { vereinId: VEREIN_BLAU, primaer: '#1d4ed8' },
        ]);
      });

      it("shows another instance's colours while open", async () => {
        const tabA = await speicher.oeffnen();
        const tabB = await speicher.oeffnen();

        await tabB.vereinsfarbenSetzen(VEREIN_ROT, { primaer: '#c8102e' });
        await speicher.bisStabil();

        expect(tabA.vereinsfarben()).toEqual([
          { vereinId: VEREIN_ROT, primaer: '#c8102e' },
        ]);
      });

      it('keeps the readable colours where one entry is malformed', async () => {
        await speicher.schreibeRoh({
          version: 2,
          teams: teamsRoh(MTV_GIFHORN),
          vereinsfarben: {
            [VEREIN_ROT]: '#c8102e',
            [VEREIN_BLAU]: 'blau',
          },
        });

        const auswahl = await speicher.oeffnen();

        expect(auswahl.vereinsfarben()).toEqual([
          { vereinId: VEREIN_ROT, primaer: '#c8102e' },
        ]);
        expect(auswahl.teams()).toEqual([MTV_GIFHORN]);
      });

      it('sets no colours from a newer version', async () => {
        const neuer = {
          version: 99,
          vereinsfarben: { [VEREIN_ROT]: '#c8102e' },
        };
        await speicher.schreibeRoh(neuer);

        const auswahl = await speicher.oeffnen();
        expect(auswahl.vereinsfarben()).toEqual([]);
        await expect(
          auswahl.vereinsfarbenSetzen(VEREIN_BLAU, { primaer: '#1d4ed8' })
        ).rejects.toBeInstanceOf(AuswahlZuNeuError);
        await expect(
          auswahl.vereinsfarbenZuruecksetzen(VEREIN_ROT)
        ).rejects.toBeInstanceOf(AuswahlZuNeuError);

        expect(await speicher.liesRoh()).toEqual(neuer);
      });
    });

    describe('caps', () => {
      const ids = (anzahl: number) =>
        Array.from({ length: anzahl }, (_, i) => 1000 + i);

      it('refuses to follow one Team more than its cap, and stores nothing', async () => {
        const voll = ids(AUSWAHL_GRENZEN.teams);
        await speicher.schreibeRoh({ version: 2, teams: teamsRoh(...voll) });
        const auswahl = await speicher.oeffnen();

        await expect(auswahl.folgen(MTV_WASBUETTEL)).rejects.toEqual(
          new AuswahlVollError('teams')
        );

        expect(auswahl.teams()).toEqual(voll);
        expect(await speicher.liesRoh()).toEqual({
          version: 2,
          teams: teamsRoh(...voll),
        });
      });

      it('refuses to mark one Kind more than its cap', async () => {
        const voll = ids(AUSWAHL_GRENZEN.kinder).map((personId) => ({
          personId,
        }));
        await speicher.schreibeRoh({ version: 2, kinder: kinderRoh(...voll) });
        const auswahl = await speicher.oeffnen();

        await expect(auswahl.markieren(LUMI)).rejects.toEqual(
          new AuswahlVollError('kinder')
        );

        expect(auswahl.kinder()).toEqual(voll);
      });

      it("refuses one Verein's colours more than their cap", async () => {
        const voll = ids(AUSWAHL_GRENZEN.vereinsfarben);
        await speicher.schreibeRoh({
          version: 2,
          vereinsfarben: Object.fromEntries(voll.map((id) => [id, '#c8102e'])),
        });
        const auswahl = await speicher.oeffnen();

        await expect(
          auswahl.vereinsfarbenSetzen(VEREIN_ROT, { primaer: '#1d4ed8' })
        ).rejects.toEqual(new AuswahlVollError('vereinsfarben'));
        // a Verein holding colours already may still change them
        await auswahl.vereinsfarbenSetzen(voll[0], { primaer: '#1d4ed8' });

        expect(auswahl.vereinsfarben()?.[0]).toEqual({
          vereinId: voll[0],
          primaer: '#1d4ed8',
        });
        expect(auswahl.vereinsfarben()).toHaveLength(voll.length);
      });

      it('still unfollows where the stored Teams are over their cap', async () => {
        const zuViele = ids(AUSWAHL_GRENZEN.teams + 1);
        await speicher.schreibeRoh({ version: 2, teams: teamsRoh(...zuViele) });
        const auswahl = await speicher.oeffnen();

        await auswahl.entfolgen(zuViele[0]);

        expect(auswahl.teams()).toEqual(zuViele.slice(1));
      });
    });

    it('follows nothing from a newer version and refuses to change it', async () => {
      const neuer = { version: 99, teams: [MTV_GIFHORN], mehr: true };
      await speicher.schreibeRoh(neuer);

      const auswahl = await speicher.oeffnen();
      expect(auswahl.teams()).toEqual([]);
      await expect(auswahl.folgen(MTV_WASBUETTEL)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );
      await expect(auswahl.entfolgen(MTV_GIFHORN)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );

      expect(auswahl.teams()).toEqual([]);
      expect(await speicher.liesRoh()).toEqual(neuer);
    });

    it('refuses once it heard a newer version wrote since it opened', async () => {
      const auswahl = await speicher.oeffnen();
      const neuer = { version: 99, teams: [] };
      await speicher.schreibeRoh(neuer);
      await speicher.bisStabil();

      await expect(auswahl.folgen(MTV_WASBUETTEL)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );
      expect(await speicher.liesRoh()).toEqual(neuer);
    });
  });
}
