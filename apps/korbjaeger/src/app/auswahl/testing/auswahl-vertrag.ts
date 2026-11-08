import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from '../auswahl';
import { AuswahlZuNeuError } from '../auswahl-fehler';

/**
 * Where one adapter of `Auswahl` keeps its data, for `auswahlVertrag`: the
 * device's storage for the local adapter, one account's document for the
 * Firestore adapter (#2873).
 */
export interface AuswahlSpeicher {
  /**
   * A new adapter on this store, as after a reload. Resolves once the
   * adapter has read what is stored (`teams()` is defined).
   */
  oeffnen(): Promise<Auswahl>;
  /** Stores `dokument` as it is, as another app version or a fault might. */
  schreibeRoh(dokument: unknown): Promise<void>;
  /** What is stored now, as it is. */
  liesRoh(): Promise<unknown>;
  /**
   * Resolves once every open adapter has seen what was last written to the
   * store (a `storage` event, a snapshot).
   */
  bisStabil(): Promise<void>;
}

const MTV_WASBUETTEL: TeamId = 313036;
const MTV_GIFHORN: TeamId = 201500;
const SV_GROSS_OESINGEN: TeamId = 201765;

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
      await tabB.folgen(MTV_GIFHORN);

      const nachher = await speicher.oeffnen();
      expect(nachher.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('unfollows a Team another instance followed since it opened', async () => {
      const tabA = await speicher.oeffnen();
      const tabB = await speicher.oeffnen();

      await tabA.folgen(MTV_WASBUETTEL);
      await tabA.folgen(MTV_GIFHORN);
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
      const kinder = [{ personId: 4711, spitzname: 'Mia' }];
      await speicher.schreibeRoh({ version: 1, teams: [MTV_GIFHORN], kinder });

      const auswahl = await speicher.oeffnen();
      await auswahl.folgen(MTV_WASBUETTEL);

      expect(await speicher.liesRoh()).toEqual({
        version: 1,
        teams: [MTV_GIFHORN, MTV_WASBUETTEL],
        kinder,
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

    it('refuses once a newer version wrote since it opened', async () => {
      const auswahl = await speicher.oeffnen();
      const neuer = { version: 99, teams: [] };
      await speicher.schreibeRoh(neuer);

      await expect(auswahl.folgen(MTV_WASBUETTEL)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );
      expect(await speicher.liesRoh()).toEqual(neuer);
    });
  });
}
