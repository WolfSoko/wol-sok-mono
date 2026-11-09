import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  AnmeldungAbgebrochen,
  KontoGewechselt,
  KontoNichtGeloescht,
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
    lokal?: LokaleAuswahl;
  } = {}
): Promise<Aufbau> {
  const dienst = optionen.dienst ?? new FakeKontoDienst();
  const lokal = optionen.lokal ?? new LokaleAuswahl(undefined);
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

  it("names another store once the account's holds the choices, and the device's again after signing out", async () => {
    const { sitzung } = await aufbauen();
    const geraet = sitzung.auswahl.quelle();

    await sitzung.anmelden();
    const konto = sitzung.auswahl.quelle();
    expect(konto).toBeDefined();
    expect(konto).not.toBe(geraet);

    await sitzung.abmelden();
    expect(sitzung.auswahl.quelle()).toBe(geraet);
  });

  describe('getting ready', () => {
    it('is ready for the click once Firebase is loaded', async () => {
      const { sitzung } = await aufbauen();
      expect(sitzung.bereit()).toBe(false);

      await sitzung.vorbereiten();

      expect(sitzung.bereit()).toBe(true);
    });

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
        vereinsfarben: [],
      });
      expect(lokal.teams()).toEqual([]);
      expect(merker.gesetzt()).toBe(true);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('tells what did not fit into the account', async () => {
      const dienst = new FakeKontoDienst();
      dienst.uebrig = {
        teams: [9001, 9002],
        kinder: [{ personId: 4711 }],
        vereinsfarben: [],
      };
      const { sitzung } = await aufbauen({ dienst });

      expect(await sitzung.anmelden()).toEqual({
        teams: [9001, 9002],
        kinder: [{ personId: 4711 }],
        vereinsfarben: [],
      });
      expect(sitzung.uebernahme()).toEqual({
        uebrig: {
          teams: [9001, 9002],
          kinder: [{ personId: 4711 }],
          vereinsfarben: [],
        },
        behalten: false,
      });
    });

    it("keeps the device's choices that did not fit on the device, and tells again at the next start", async () => {
      const dienst = new FakeKontoDienst();
      const lokal = new LokaleAuswahl(undefined);
      await lokal.folgen(313036);
      await lokal.folgen(9001);
      dienst.uebrig = { teams: [9001], kinder: [], vereinsfarben: [] };
      const { sitzung } = await aufbauen({ dienst, lokal });

      await sitzung.anmelden();

      expect(lokal.teams()).toEqual([9001]);
      expect(sitzung.uebernahme()?.uebrig.teams).toEqual([9001]);
      expect(sitzung.uebernahme()?.behalten).toBe(false);

      const neu = await aufbauen({ dienst, lokal, angemeldetGewesen: true });
      expect(neu.sitzung.uebernahme()?.uebrig.teams).toEqual([9001]);
    });

    it("drops the takeover's notice once another tab switched to another account", async () => {
      const dienst = new FakeKontoDienst();
      dienst.uebrig = { teams: [9001], kinder: [], vereinsfarben: [] };
      const { sitzung } = await aufbauen({ dienst });
      await sitzung.anmelden();

      dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
      await abwarten();

      expect(sitzung.uebernahme()).toBeUndefined();
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
      // the second round takes what joined; the first took the rest
      expect(dienst.uebernommen?.teams).toEqual([201500]);
      expect(lokal.teams()).toEqual([]);
    });

    it("keeps the device's choices where they changed during every takeover", async () => {
      const { sitzung, dienst, lokal } = await aufbauen();
      let team = 900000;
      dienst.beiJederUebernahme = () => lokal.folgen(team++);

      await sitzung.anmelden();

      expect(sitzung.uebernahme()?.behalten).toBe(true);
      expect(lokal.teams()?.length).toBeGreaterThan(0);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('keeps choices a takeover kept on the device when signing out before the next start', async () => {
      const { sitzung, dienst, lokal } = await aufbauen();
      let team = 900000;
      dienst.beiJederUebernahme = () => lokal.folgen(team++);
      await sitzung.anmelden();
      dienst.beiJederUebernahme = undefined;
      const behalten = lokal.teams();

      await sitzung.abmelden();

      expect(lokal.teams()).toEqual(behalten);
      expect(sitzung.auswahl.teams()).toEqual(behalten);
    });

    it('takes off the device only what it took over, so a Kind renamed meanwhile goes over next', async () => {
      const { sitzung, dienst, lokal } = await aufbauen();
      await lokal.folgen(313036);
      await lokal.markieren({ art: 'benannt', personId: 4711 }, 'Mimi');
      const uebernommen: unknown[] = [];
      dienst.beiJederUebernahme = async () => {
        uebernommen.push(dienst.uebernommen);
        if (uebernommen.length === 1) {
          await lokal.spitznameSetzen(4711, 'Mi');
        }
      };

      await sitzung.anmelden();

      expect(dienst.uebernommen).toEqual({
        teams: [],
        kinder: [{ personId: 4711, spitzname: 'Mi' }],
        vereinsfarben: [],
      });
      expect(lokal.kinder()).toEqual([]);
      expect(sitzung.uebernahme()?.behalten).toBe(false);
    });

    it('takes over what another tab stored meanwhile, before its storage event', async () => {
      const speicher = new Map<string, string>();
      const geraet = {
        getItem: (key: string) => speicher.get(key) ?? null,
        setItem: (key: string, value: string) => void speicher.set(key, value),
        removeItem: (key: string) => void speicher.delete(key),
      };
      const lokal = new LokaleAuswahl(geraet);
      const dienst = new FakeKontoDienst();
      const { sitzung } = await aufbauen({ dienst, lokal });
      await lokal.folgen(313036);
      dienst.waehrendUebernahme = async () => {
        // another tab, its storage event not here yet
        speicher.set(
          'korbjaeger-auswahl',
          JSON.stringify({ version: 1, teams: [313036, 201500], kinder: [] })
        );
      };

      await sitzung.anmelden();

      // the second round takes what joined; the first took the rest
      expect(dienst.uebernommen?.teams).toEqual([201500]);
      expect(sitzung.uebernahme()?.behalten).toBe(false);
      expect(lokal.teams()).toEqual([]);
    });

    it('takes the kept choices over at the next start', async () => {
      const dienst = new FakeKontoDienst();
      dienst.wiederhergestellt = MIMI_ELTERN;
      const lokal = new LokaleAuswahl(undefined);
      await lokal.folgen(201500);

      const { sitzung } = await aufbauen({
        angemeldetGewesen: true,
        dienst,
        lokal,
      });

      expect(dienst.uebernommen?.teams).toEqual([201500]);
      expect(lokal.teams()).toEqual([]);
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('keeps the account open, and the kept choices, where taking them over at the start fails', async () => {
      const dienst = new FakeKontoDienst();
      dienst.wiederhergestellt = MIMI_ELTERN;
      dienst.uebernahmeScheitert = true;
      const lokal = new LokaleAuswahl(undefined);
      await lokal.folgen(201500);

      const { sitzung } = await aufbauen({
        angemeldetGewesen: true,
        dienst,
        lokal,
      });

      expect(sitzung.stand()).toEqual(ANGEMELDET);
      expect(sitzung.auswahl.nichtLesbar()).toBe(false);
      expect(sitzung.uebernahme()?.behalten).toBe(true);
      expect(lokal.teams()).toEqual([201500]);
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
    it("deletes nothing where another tab switched the account during Google's question", async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.waehrendPopup = () => {
        dienst.wiederhergestellt = { uid: 'uid-2', name: 'Familie Beispiel' };
      };

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(KontoGewechselt);

      expect(dienst.aufrufe).not.toContain('auswahlLoeschen uid-1');
      expect(dienst.aufrufe.some((a) => a.startsWith('benutzerLoeschen'))).toBe(
        false
      );
    });

    it('deletes the account it asked Google about, by its uid', async () => {
      const { sitzung, dienst } = await angemeldet();

      await sitzung.loeschen();

      expect(dienst.aufrufe).toContain('benutzerLoeschen uid-1');
    });

    it('says the account is still there where Auth refuses it after its document went', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.benutzerLoeschenScheitert = true;

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(
        KontoNichtGeloescht
      );

      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('is refused while the start takes kept choices over', async () => {
      const dienst = new FakeKontoDienst();
      dienst.wiederhergestellt = MIMI_ELTERN;
      const uebernahme = Promise.withResolvers<void>();
      dienst.waehrendUebernahme = () => uebernahme.promise;
      const lokal = new LokaleAuswahl(undefined);
      await lokal.folgen(201500);
      const sitzung = new KontoSitzung(
        lokal,
        async () => dienst,
        new MerkerImSpec(true)
      );
      const gestartet = sitzung.starten();
      await abwarten();

      await expect(sitzung.loeschen()).rejects.toThrow();

      uebernahme.resolve();
      await gestartet;
      expect(dienst.aufrufe).not.toContain('auswahlLoeschen uid-1');
    });

    it('tells the step running, and the failure of the last one, to any page', async () => {
      const { sitzung, dienst } = await angemeldet();
      const bestaetigt = Promise.withResolvers<void>();
      dienst.loeschenBestaetigt = bestaetigt.promise;
      dienst.benutzerLoeschenScheitert = true;

      const loeschen = sitzung.loeschen().catch(() => undefined);
      await abwarten();
      expect(sitzung.laeuft()).toBe('loeschen');

      bestaetigt.resolve();
      await loeschen;
      expect(sitzung.laeuft()).toBeUndefined();
      expect(sitzung.fehlschlag()?.art).toBe('loeschen');
      expect(sitzung.fehlschlag()?.fehler).toBeInstanceOf(KontoNichtGeloescht);

      dienst.benutzerLoeschenScheitert = false;
      const zweiterVersuch = sitzung.loeschen();
      expect(sitzung.fehlschlag()).toBeUndefined();
      await zweiterVersuch;
    });

    it('asks Google first, then deletes the document, then the account', async () => {
      const { sitzung, dienst, merker } = await angemeldet();

      await sitzung.loeschen();

      expect(dienst.aufrufe).toEqual([
        'erneutAnmelden',
        'auswahlLoeschen uid-1',
        'benutzerLoeschen uid-1',
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

    it('deletes the account only once the server confirmed its document gone, however long that takes', async () => {
      const { sitzung, dienst } = await angemeldet();
      const bestaetigt = Promise.withResolvers<void>();
      dienst.loeschenBestaetigt = bestaetigt.promise;

      const loeschen = sitzung.loeschen();
      await abwarten();
      expect(dienst.aufrufe).toEqual([
        'erneutAnmelden',
        'auswahlLoeschen uid-1',
      ]);
      expect(sitzung.stand()).toEqual(ANGEMELDET);

      bestaetigt.resolve();
      await loeschen;
      expect(dienst.aufrufe).toContain('benutzerLoeschen uid-1');
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
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

      await dienst.auswahlVon('uid-2').folgen(201765);
      dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
      await abwarten();

      expect(dienst.aufrufe).toEqual(['beenden', 'auswahl uid-2']);
      expect(sitzung.auswahl.teams()).toEqual([201765]);
      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Beispiel',
      });
    });

    it('follows a sign-out another tab made while its own popup was open', async () => {
      const { sitzung, dienst } = await angemeldet();
      dienst.abgebrochen = true;
      dienst.waehrendPopup = () => {
        dienst.wiederhergestellt = null;
        dienst.authMeldet(null);
      };

      await expect(sitzung.loeschen()).rejects.toBeInstanceOf(
        AnmeldungAbgebrochen
      );
      await abwarten();

      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
      expect(sitzung.auswahl.teams()).toEqual([]);
    });

    it("shows nothing of the old account while the new one's opens", async () => {
      const { sitzung, dienst } = await angemeldet();
      const { promise, resolve } = Promise.withResolvers<void>();
      dienst.auswahlBereit = promise;

      dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
      await abwarten();

      expect(sitzung.auswahl.teams()).toBeUndefined();
      expect(sitzung.stand()).toEqual({ art: 'laedt' });
      resolve();
      await abwarten();
      expect(sitzung.stand()).toEqual({
        art: 'angemeldet',
        name: 'Familie Beispiel',
      });
    });

    it("keeps the device's choices when another tab's sign-in fails and signs out", async () => {
      const { sitzung, dienst, lokal } = await aufbauen();
      await sitzung.vorbereiten();
      await lokal.folgen(313036);

      // the other tab signs in, cannot take the choices over, signs out
      dienst.authMeldet(MIMI_ELTERN);
      await abwarten();
      dienst.authMeldet(null);
      await abwarten();

      expect(lokal.teams()).toEqual([313036]);
      expect(sitzung.auswahl.teams()).toEqual([313036]);
    });

    describe('while an account opens', () => {
      async function oeffnetGerade() {
        const aufbau = await aufbauen();
        await aufbau.sitzung.vorbereiten();
        const bereit = Promise.withResolvers<void>();
        aufbau.dienst.auswahlBereit = bereit.promise;
        const zaehlen = (aufruf: string) =>
          aufbau.dienst.aufrufe.filter((a) => a === aufruf).length;
        return { ...aufbau, bereit: bereit.resolve, zaehlen };
      }

      it('shows nothing of it where another tab signed out meanwhile', async () => {
        const { sitzung, dienst, bereit, zaehlen } = await oeffnetGerade();
        dienst.authMeldet(MIMI_ELTERN);
        await abwarten();

        dienst.authMeldet(null);
        bereit();
        await abwarten();

        expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
        expect(sitzung.auswahl.teams()).toEqual([]);
        expect(zaehlen('beenden')).toBe(zaehlen('auswahl uid-1'));
      });

      it('shows the account another tab switched to meanwhile, the first closed', async () => {
        const { sitzung, dienst, bereit, zaehlen } = await oeffnetGerade();
        dienst.authMeldet(MIMI_ELTERN);
        await abwarten();

        dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
        bereit();
        await abwarten();

        expect(sitzung.stand()).toEqual({
          art: 'angemeldet',
          name: 'Familie Beispiel',
        });
        expect(zaehlen('beenden')).toBe(1);
      });

      it('opens it once where another tab tells twice, the other opening closed', async () => {
        const { sitzung, dienst, merker, bereit, zaehlen } =
          await oeffnetGerade();
        dienst.wiederhergestellt = MIMI_ELTERN;

        merker.vonAnderemTab(true);
        merker.vonAnderemTab(true);
        await abwarten();
        bereit();
        await abwarten();

        expect(sitzung.stand()).toEqual(ANGEMELDET);
        expect(zaehlen('auswahl uid-1') - zaehlen('beenden')).toBe(1);
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

    it('says it cannot read where the account fails otherwise, its choices unshown', async () => {
      const { sitzung, dienst } = await angemeldet();
      await dienst.kontoAuswahl.folgen(313036);
      expect(sitzung.auswahl.teams()).toEqual([313036]);

      dienst.lesefehler?.({ code: 'unavailable' });

      expect(sitzung.stand()).toEqual({ art: 'nicht-erreichbar' });
      expect(sitzung.auswahl.nichtLesbar()).toBe(true);
      expect(sitzung.auswahl.teams()).toBeUndefined();
      expect(sitzung.auswahl.kinder()).toBeUndefined();
      await expect(sitzung.auswahl.folgen(201500)).rejects.toThrow();
    });

    it("says it cannot open an account another tab signed in to, and tries again on Auth's next word", async () => {
      const { sitzung, dienst } = await aufbauen();
      await sitzung.vorbereiten();
      dienst.auswahlScheitert = true;

      dienst.authMeldet(MIMI_ELTERN);
      await abwarten();
      expect(sitzung.stand()).toEqual({ art: 'nicht-erreichbar' });

      dienst.auswahlScheitert = false;
      dienst.authMeldet(MIMI_ELTERN);
      await abwarten();
      expect(sitzung.stand()).toEqual(ANGEMELDET);
    });

    it('lets a start that found nobody signed in give way to a sign-in in another tab meanwhile', async () => {
      const dienst = new FakeKontoDienst();
      const geleert = Promise.withResolvers<void>();
      dienst.zwischenspeicherBereit = geleert.promise;
      const merker = new MerkerImSpec(true);
      const sitzung = new KontoSitzung(
        new LokaleAuswahl(undefined),
        async () => dienst,
        merker
      );
      const gestartet = sitzung.starten();
      await abwarten();

      dienst.authMeldet(MIMI_ELTERN);
      await abwarten();
      geleert.resolve();
      await gestartet;

      expect(sitzung.stand()).toEqual(ANGEMELDET);
      expect(merker.gesetzt()).toBe(true);
    });

    it('clears the cache a sign-out left at a start without anyone signed in', async () => {
      const merker = new MerkerImSpec(false);
      merker.aufraeumen = true;
      const dienst = new FakeKontoDienst();
      const sitzung = new KontoSitzung(
        new LokaleAuswahl(undefined),
        async () => dienst,
        merker
      );

      await sitzung.starten();
      await abwarten();

      expect(dienst.aufrufe).toEqual(['zwischenspeicherLeeren']);
      expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    });
  });
});
