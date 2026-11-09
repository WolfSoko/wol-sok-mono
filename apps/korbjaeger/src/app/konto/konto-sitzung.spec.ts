import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  AnmeldungAbgebrochen,
  NichtAllesGesendet,
  OhneInternet,
} from './konto-dienst';
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
  online: boolean;
}

async function aufbauen(
  optionen: {
    angemeldetGewesen?: boolean;
    ohneAnmeldung?: boolean;
    dienst?: FakeKontoDienst;
  } = {}
): Promise<Aufbau> {
  const dienst = optionen.dienst ?? new FakeKontoDienst();
  const lokal = new LokaleAuswahl(undefined);
  const merker = new MerkerImSpec(optionen.angemeldetGewesen);
  let ladevorgaenge = 0;
  const laden = async () => {
    ladevorgaenge++;
    return dienst;
  };
  const aufbau: Omit<Aufbau, 'sitzung'> & { sitzung?: KontoSitzung } = {
    dienst,
    lokal,
    merker,
    geladen: () => ladevorgaenge,
    online: true,
  };
  const sitzung = new KontoSitzung(
    lokal,
    optionen.ohneAnmeldung ? undefined : laden,
    merker,
    () => aufbau.online
  );
  aufbau.sitzung = sitzung;
  await sitzung.starten();
  return aufbau as Aufbau;
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

/** Lets the promises a callback started settle. */
const abwarten = () => new Promise((weiter) => setTimeout(weiter));

const ANGEMELDET = { art: 'angemeldet', name: 'Familie Muster' } as const;

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
      expect(sitzung.auswahl.nichtLesbar()).toBe(false);
      expect(geladen()).toBe(0);
    });

    it('opens the account of an Elternteil signed in before', async () => {
      const dienst = new FakeKontoDienst();
      dienst.wiederhergestellt = MIMI_ELTERN;

      const { sitzung } = await aufbauen({ angemeldetGewesen: true, dienst });

      expect(sitzung.stand()).toEqual(ANGEMELDET);
      expect(dienst.aufrufe).toEqual(['angemeldet', 'auswahl uid-1']);
    });

    it('goes back to the device where Auth holds the Elternteil no longer, its cache cleared first', async () => {
      const { sitzung, merker, dienst } = await aufbauen({
        angemeldetGewesen: true,
      });

      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(merker.gesetzt()).toBe(false);
      expect(dienst.aufrufe).toEqual(['angemeldet', 'zwischenspeicherLeeren']);
    });

    it("says it cannot read, and shows no device's choices, while the account cannot be opened", async () => {
      const sitzung = new KontoSitzung(
        new LokaleAuswahl(undefined),
        () => Promise.reject(new Error('offline')),
        new MerkerImSpec(true)
      );

      await sitzung.starten();

      expect(sitzung.stand()).toEqual({ art: 'nicht-erreichbar' });
      expect(sitzung.auswahl.teams()).toBeUndefined();
      expect(sitzung.auswahl.nichtLesbar()).toBe(true);
    });
  });

  describe('getting ready', () => {
    it('loads Firebase once, ahead of the click', async () => {
      const { sitzung, geladen } = await aufbauen();

      await sitzung.vorbereiten();
      await sitzung.vorbereiten();
      await sitzung.anmelden();

      expect(geladen()).toBe(1);
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
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('tells what did not fit into the account', async () => {
      const dienst = new FakeKontoDienst();
      dienst.uebrig = { teams: 2, kinder: 1 };
      const { sitzung } = await aufbauen({ dienst });

      expect(await sitzung.anmelden()).toEqual({ teams: 2, kinder: 1 });
    });

    it("shows the account's choices once signed in", async () => {
      const { sitzung, dienst } = await angemeldet();

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
        'zwischenspeicherLeeren',
      ]);
      expect(lokal.teams()).toEqual([313036]);
      expect(merker.gesetzt()).toBe(false);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });

    it('takes over what changed on the device while it took over', async () => {
      const { sitzung, dienst, lokal } = await aufbauen();
      await lokal.folgen(313036);
      dienst.waehrendUebernahme = () => lokal.folgen(201500);

      await sitzung.anmelden();

      expect(dienst.aufrufe).toEqual([
        'mitGoogleAnmelden',
        'geraetUebernehmen uid-1',
        'geraetUebernehmen uid-1',
        'auswahl uid-1',
      ]);
      expect(dienst.uebernommen?.teams).toEqual([313036, 201500]);
      expect(lokal.teams()).toEqual([]);
    });

    it('runs one sign-in at a time: a second click joins the first', async () => {
      const { sitzung, dienst } = await aufbauen();

      await Promise.all([sitzung.anmelden(), sitzung.anmelden()]);

      expect(
        dienst.aufrufe.filter((aufruf) => aufruf === 'mitGoogleAnmelden')
      ).toHaveLength(1);
    });

    it("reports the takeover's failure even where signing out again fails too", async () => {
      const { sitzung, dienst } = await aufbauen();
      dienst.uebernahmeScheitert = true;
      dienst.abmeldenScheitert = true;

      await expect(sitzung.anmelden()).rejects.toThrow('offline');
    });
  });

  describe('signing out', () => {
    it("signs out first, then takes the account's choices off the device", async () => {
      const { sitzung, dienst, lokal, merker } = await angemeldet();

      await sitzung.abmelden();

      expect(dienst.aufrufe).toEqual([
        'allesGesendet',
        'abmelden',
        'beenden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
      expect(lokal.kinder()).toEqual([]);
      expect(merker.gesetzt()).toBe(false);
    });

    it('refuses while changes have not reached the account, nothing changed', async () => {
      const { sitzung, dienst, merker } = await angemeldet();
      dienst.nichtGesendet = true;

      await expect(sitzung.abmelden()).rejects.toBeInstanceOf(
        NichtAllesGesendet
      );

      expect(dienst.aufrufe).toEqual(['allesGesendet']);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
      expect(merker.gesetzt()).toBe(true);
    });

    it('stays signed in, the account open, where Auth does not sign out', async () => {
      const { sitzung, dienst, merker } = await angemeldet();
      dienst.abmeldenScheitert = true;

      await expect(sitzung.abmelden()).rejects.toThrow('Auth unreachable');

      expect(dienst.aufrufe).toEqual(['allesGesendet', 'abmelden']);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
      expect(sitzung.auswahl.teams()).toBe(dienst.kontoAuswahl.teams());
      expect(merker.gesetzt()).toBe(true);
    });
  });

  describe('deleting the account', () => {
    it('asks Google first, then deletes the document, then the account', async () => {
      const { sitzung, dienst, merker } = await angemeldet();

      await sitzung.loeschen();

      expect(dienst.aufrufe).toEqual([
        'erneutAnmelden',
        'auswahlLoeschen uid-1',
        'benutzerLoeschen',
        'beenden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
      expect(merker.gesetzt()).toBe(false);
    });

    it('deletes nothing where the Elternteil cancels Google', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.abgebrochen = true;

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(
        AnmeldungAbgebrochen
      );

      expect(dienst.aufrufe).toEqual(['erneutAnmelden']);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('deletes nothing offline', async () => {
      const aufbau = await angemeldet();
      aufbau.online = false;

      await expect(aufbau.sitzung.loeschen()).rejects.toBeInstanceOf(
        OhneInternet
      );

      expect(aufbau.dienst.aufrufe).toEqual([]);
      expect(aufbau.sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('keeps the account where the server does not confirm the document gone', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.loeschenOhneServer = true;

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(OhneInternet);

      expect(dienst.aufrufe).not.toContain('benutzerLoeschen');
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });
  });

  describe('beside other tabs', () => {
    it('follows a sign-out in another tab', async () => {
      const { sitzung, dienst, merker } = await angemeldet();

      dienst.authMeldet(null);
      await abwarten();

      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
      expect(merker.gesetzt()).toBe(false);
      expect(dienst.aufrufe).toEqual(['beenden', 'zwischenspeicherLeeren']);
    });

    it('switches to the account another tab signed in to instead', async () => {
      const { sitzung, dienst } = await angemeldet();

      dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
      await abwarten();

      expect(dienst.aufrufe).toEqual(['beenden', 'auswahl uid-2']);
      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Beispiel',
      });
    });

    it('follows a sign-in in another tab, once Firebase is loaded here', async () => {
      const { sitzung, dienst } = await aufbauen();
      await sitzung.vorbereiten();

      dienst.authMeldet(MIMI_ELTERN);
      await abwarten();

      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('opens the account another tab signed in to, before Firebase is loaded here', async () => {
      const dienst = new FakeKontoDienst();
      const { sitzung, merker, geladen } = await aufbauen({ dienst });
      expect(geladen()).toBe(0);
      dienst.wiederhergestellt = MIMI_ELTERN;

      merker.vonAnderemTab(true);
      await abwarten();

      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('signs out where the account can no longer be read', async () => {
      const { sitzung, dienst } = await angemeldet();

      dienst.lesefehler?.({ code: 'permission-denied' });
      await abwarten();

      expect(dienst.aufrufe).toEqual([
        'abmelden',
        'beenden',
        'zwischenspeicherLeeren',
      ]);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });

    it('says it cannot read where the account fails otherwise', async () => {
      const { sitzung, dienst } = await angemeldet();

      dienst.lesefehler?.({ code: 'unavailable' });

      expect(sitzung.stand()).toEqual({ art: 'nicht-erreichbar' });
      expect(sitzung.auswahl.nichtLesbar()).toBe(true);
    });
  });
});
