import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { AnmeldungAbgebrochen } from './konto-dienst';
import { KontoSitzung } from './konto-sitzung';
import {
  FakeKontoDienst,
  MerkerImSpec,
  MIMI_ELTERN,
} from './testing/fake-konto-dienst';

interface Aufbau {
  readonly sitzung: KontoSitzung;
  readonly dienst: FakeKontoDienst;
  readonly lokal: LokaleAuswahl;
  readonly merker: MerkerImSpec;
  readonly geladen: () => number;
}

async function aufbauen(
  optionen: { angemeldetGewesen?: boolean; ohneAnmeldung?: boolean } = {}
): Promise<Aufbau> {
  const dienst = new FakeKontoDienst();
  const lokal = new LokaleAuswahl(undefined);
  const merker = new MerkerImSpec(optionen.angemeldetGewesen);
  let ladevorgaenge = 0;
  const laden = async () => {
    ladevorgaenge++;
    return dienst;
  };
  const sitzung = new KontoSitzung(
    lokal,
    optionen.ohneAnmeldung ? undefined : laden,
    merker
  );
  await sitzung.starten();
  return { sitzung, dienst, lokal, merker, geladen: () => ladevorgaenge };
}

/** Signed in, with Meine Teams and a Kind chosen on the device before. */
async function angemeldet(): Promise<Aufbau> {
  const aufbau = await aufbauen();
  await aufbau.lokal.folgen(313036);
  await aufbau.lokal.markieren({ art: 'benannt', personId: 4711 }, 'Mimi');
  await aufbau.sitzung.anmelden();
  aufbau.dienst.aufrufe.length = 0;
  return aufbau;
}

describe('KontoSitzung', () => {
  describe('at start', () => {
    it('offers no account and loads nothing where the build has no sign-in', async () => {
      const { sitzung, lokal, geladen } = await aufbauen({
        ohneAnmeldung: true,
      });
      await lokal.folgen(313036);

      expect(sitzung.stand()).toEqual({ art: 'aus' });
      expect(sitzung.auswahl.teams()).toEqual([313036]);
      expect(geladen()).toBe(0);
    });

    it('keeps an Elternteil never signed in on the device, without loading Firebase', async () => {
      const { sitzung, lokal, geladen } = await aufbauen();
      await lokal.folgen(313036);

      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([313036]);
      expect(geladen()).toBe(0);
    });

    it('opens the account of an Elternteil signed in before', async () => {
      const dienst = new FakeKontoDienst();
      dienst.wiederhergestellt = MIMI_ELTERN;
      const sitzung = new KontoSitzung(
        new LokaleAuswahl(undefined),
        async () => dienst,
        new MerkerImSpec(true)
      );

      await sitzung.starten();

      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Muster',
      });
      expect(dienst.aufrufe).toEqual(['angemeldet', 'auswahl uid-1']);
    });

    it('goes back to the device where Auth holds the Elternteil no longer', async () => {
      const { sitzung, merker } = await aufbauen({ angemeldetGewesen: true });

      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(merker.gesetzt()).toBe(false);
    });

    it("shows no device's choices while the account cannot be opened", async () => {
      const sitzung = new KontoSitzung(
        new LokaleAuswahl(undefined),
        () => Promise.reject(new Error('offline')),
        new MerkerImSpec(true)
      );

      await sitzung.starten();

      expect(sitzung.stand()).toEqual({ art: 'nicht-erreichbar' });
      expect(sitzung.auswahl.teams()).toBeUndefined();
    });
  });

  describe('signing in', () => {
    it("takes the device's choices into the account, then off the device", async () => {
      const { sitzung, dienst, lokal, merker } = await aufbauen();
      await lokal.folgen(313036);
      await lokal.markieren({ art: 'benannt', personId: 4711 }, 'Mimi');

      await sitzung.anmelden();

      expect(dienst.aufrufe).toEqual([
        'mitGoogleAnmelden',
        'geraetUebernehmen uid-1',
        'auswahl uid-1',
      ]);
      expect(dienst.uebernommen).toEqual({
        teams: [313036],
        kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      });
      expect(lokal.teams()).toEqual([]);
      expect(merker.gesetzt()).toBe(true);
      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Muster',
      });
    });

    it("shows the account's choices once signed in", async () => {
      const { sitzung, dienst } = await angemeldet();

      await sitzung.auswahl.folgen(201500);

      expect(sitzung.auswahl.teams()).toBe(dienst.kontoAuswahl.teams());
    });

    it('changes nothing when the popup was closed', async () => {
      const { sitzung, dienst, lokal, merker } = await aufbauen();
      await lokal.folgen(313036);
      dienst.abgebrochen = true;

      await expect(sitzung.anmelden()).rejects.toBeInstanceOf(
        AnmeldungAbgebrochen
      );

      expect(dienst.aufrufe).toEqual(['mitGoogleAnmelden']);
      expect(lokal.teams()).toEqual([313036]);
      expect(merker.gesetzt()).toBe(false);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });

    it("signs out again, the device's choices kept, where they could not be taken over", async () => {
      const { sitzung, dienst, lokal, merker } = await aufbauen();
      await lokal.folgen(313036);
      dienst.uebernahmeScheitert = true;

      await expect(sitzung.anmelden()).rejects.toThrow('offline');

      expect(dienst.aufrufe).toEqual([
        'mitGoogleAnmelden',
        'geraetUebernehmen uid-1',
        'abmelden',
      ]);
      expect(lokal.teams()).toEqual([313036]);
      expect(merker.gesetzt()).toBe(false);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });
  });

  describe('signing out', () => {
    it("takes the account's choices off the device and starts it empty", async () => {
      const { sitzung, dienst, lokal, merker } = await angemeldet();

      await sitzung.abmelden();

      expect(dienst.aufrufe).toEqual([
        'beenden',
        'abmelden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
      expect(lokal.kinder()).toEqual([]);
      expect(merker.gesetzt()).toBe(false);
    });
  });

  describe('deleting the account', () => {
    it('deletes the document before the account', async () => {
      const { sitzung, dienst, merker } = await angemeldet();

      await sitzung.loeschen();

      expect(dienst.aufrufe).toEqual([
        'auswahlLoeschen uid-1',
        'benutzerLoeschen',
        'beenden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
      expect(merker.gesetzt()).toBe(false);
    });

    it('asks Google once more where Auth wants a fresh sign-in, then deletes', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.frischAnmelden = true;

      await sitzung.loeschen();

      expect(dienst.aufrufe).toEqual([
        'auswahlLoeschen uid-1',
        'benutzerLoeschen',
        'erneutAnmelden',
        'benutzerLoeschen',
        'beenden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });

    it('stays signed in where the Elternteil closes that popup', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.frischAnmelden = true;
      dienst.abgebrochen = true;

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(
        AnmeldungAbgebrochen
      );

      expect(dienst.aufrufe).not.toContain('zwischenspeicherLeeren');
      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Muster',
      });
    });
  });
});
