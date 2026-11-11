import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import { provideDarstellung } from '../darstellung/darstellung';
import { EinstellungenComponent } from './einstellungen.component';
import { nichtUebernommenText } from './nicht-uebernommen-text';
import { PopupBlockiert } from './konto-dienst';
import { KONTO_SITZUNG } from './konto';
import { KontoSitzung } from './konto-sitzung';
import { FakeKontoDienst, MerkerImSpec } from './testing/fake-konto-dienst';

interface Seite {
  readonly element: HTMLElement;
  readonly dienst: FakeKontoDienst;
  readonly geladen: () => number;
  readonly stabil: () => Promise<void>;
  readonly knopf: (qa: string) => HTMLButtonElement | null;
  readonly fehler: () => string | undefined;
}

async function oeffnen(
  optionen: {
    ohneAnmeldung?: boolean;
    dienst?: FakeKontoDienst;
    online?: () => boolean;
    lokal?: LocalSelection;
    /** Holds Firebase's chunk back until it resolves. */
    ladenWartetAuf?: Promise<void>;
    /** How many loads of Firebase's chunk fail first (offline). */
    ladenScheitert?: number;
  } = {}
): Promise<Seite> {
  const dienst = optionen.dienst ?? new FakeKontoDienst();
  let ladevorgaenge = 0;
  const sitzung = new KontoSitzung(
    optionen.lokal ?? new LocalSelection(undefined),
    optionen.ohneAnmeldung
      ? undefined
      : async () => {
          ladevorgaenge++;
          await optionen.ladenWartetAuf;
          if (ladevorgaenge <= (optionen.ladenScheitert ?? 0)) {
            throw new Error('Failed to fetch dynamically imported module');
          }
          return dienst;
        },
    new MerkerImSpec(),
    optionen.online
  );
  await sitzung.starten();
  TestBed.configureTestingModule({
    providers: [
      { provide: KONTO_SITZUNG, useValue: sitzung },
      provideDarstellung(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(EinstellungenComponent);
  const element = fixture.nativeElement as HTMLElement;
  const stabil = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise((weiter) => setTimeout(weiter));
    fixture.detectChanges();
  };
  await stabil();
  return {
    element,
    dienst,
    geladen: () => ladevorgaenge,
    stabil,
    knopf: (qa) =>
      element.querySelector<HTMLButtonElement>(`[data-qa="${qa}"]`),
    fehler: () =>
      element.querySelector('.fehler[role="alert"]')?.textContent?.trim(),
  };
}

async function angemeldet(
  dienst?: FakeKontoDienst,
  online?: () => boolean
): Promise<Seite> {
  const seite = await oeffnen({ dienst, online });
  seite.knopf('anmelden')?.click();
  await seite.stabil();
  seite.dienst.aufrufe.length = 0;
  return seite;
}

/** The delete dialog's confirm, or its cancel. */
function imDialog(qa: 'konto-loeschen-bestaetigen' | 'abbrechen'): void {
  const knoepfe = document.querySelectorAll<HTMLButtonElement>(
    'korb-konto-loeschen-dialog button'
  );
  const knopf = [...knoepfe].find((element) =>
    qa === 'abbrechen'
      ? element.textContent?.trim() === 'Abbrechen'
      : element.dataset['qa'] === qa
  );
  knopf?.click();
}

describe('EinstellungenComponent', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('offers only the look where the build offers no sign-in', async () => {
    const { element, knopf } = await oeffnen({ ohneAnmeldung: true });

    expect(element.querySelector('korb-darstellung-wahl')).not.toBeNull();
    expect(element.textContent).not.toContain('Konto');
    expect(knopf('anmelden')).toBeNull();
  });

  it('loads Firebase as it opens, so the click opens the popup at once', async () => {
    const { geladen, dienst } = await oeffnen();

    expect(geladen()).toBe(1);
    expect(dienst.aufrufe).toEqual([]);
  });

  it('signs in with Google and names the account', async () => {
    const { element, knopf, stabil, dienst } = await oeffnen();

    knopf('anmelden')?.click();
    await stabil();

    expect(dienst.aufrufe[0]).toBe('mitGoogleAnmelden');
    expect(
      element.querySelector('[data-qa="konto-name"]')?.textContent?.trim()
    ).toBe('Angemeldet als Familie Muster');
    expect(knopf('anmelden')).toBeNull();
    expect(knopf('abmelden')).not.toBeNull();
  });

  it('shows nothing when the Elternteil closes the popup', async () => {
    const dienst = new FakeKontoDienst();
    dienst.abgebrochen = true;
    const { knopf, stabil, fehler } = await oeffnen({ dienst });

    knopf('anmelden')?.click();
    await stabil();

    expect(fehler()).toBeUndefined();
    expect(knopf('anmelden')).not.toBeNull();
  });

  it('says so where the browser blocked the popup', async () => {
    const dienst = new FakeKontoDienst();
    dienst.popupFehler = new PopupBlockiert();
    const { knopf, stabil, fehler } = await oeffnen({ dienst });

    knopf('anmelden')?.click();
    await stabil();

    expect(fehler()).toBe(
      'Dein Browser hat das Fenster von Google blockiert. Erlaube Pop-ups für diese Seite und versuche es noch einmal.'
    );
  });

  it('keeps the sign-in disabled, saying it is getting ready, until Firebase is loaded', async () => {
    let geladen = (): void => undefined;
    const ladenWartetAuf = new Promise<void>((weiter) => (geladen = weiter));
    const { knopf, stabil, element } = await oeffnen({ ladenWartetAuf });

    expect(knopf('anmelden')?.disabled).toBe(true);
    expect(
      element.querySelector('[data-qa="anmeldung-vorbereiten"]')
    ).not.toBeNull();

    geladen();
    await stabil();

    expect(knopf('anmelden')?.disabled).toBe(false);
    expect(
      element.querySelector('[data-qa="anmeldung-vorbereiten"]')
    ).toBeNull();
  });

  it('says where the sign-in could not be loaded, and loads it again on asking', async () => {
    const { knopf, stabil, element, geladen } = await oeffnen({
      ladenScheitert: 1,
    });

    expect(knopf('anmelden')?.disabled).toBe(true);
    expect(
      element
        .querySelector('[data-qa="vorbereiten-fehlgeschlagen"]')
        ?.textContent?.trim()
    ).toBe(
      'Die Anmeldung ließ sich nicht laden. Bitte prüfe die Internetverbindung.'
    );

    knopf('vorbereiten-erneut')?.click();
    await stabil();

    expect(geladen()).toBe(2);
    expect(knopf('anmelden')?.disabled).toBe(false);
    expect(
      element.querySelector('[data-qa="vorbereiten-fehlgeschlagen"]')
    ).toBeNull();
  });

  it('shows a deletion still running, and its failure, on settings opened again meanwhile', async () => {
    const dienst = new FakeKontoDienst();
    const seite = await angemeldet(dienst);
    const bestaetigt = Promise.withResolvers<void>();
    dienst.loeschenBestaetigt = bestaetigt.promise;
    dienst.benutzerLoeschenScheitert = true;
    seite.knopf('konto-loeschen')?.click();
    await seite.stabil();
    imDialog('konto-loeschen-bestaetigen');
    await seite.stabil();

    const wieder = TestBed.createComponent(EinstellungenComponent);
    wieder.detectChanges();
    const element = wieder.nativeElement as HTMLElement;
    expect(element.querySelector('[data-qa="loeschen-laeuft"]')).not.toBeNull();
    expect(
      element.querySelector<HTMLButtonElement>('[data-qa="abmelden"]')?.disabled
    ).toBe(true);

    bestaetigt.resolve();
    await seite.stabil();
    wieder.detectChanges();
    expect(
      element.querySelector('.fehler[role="alert"]')?.textContent?.trim()
    ).toBe(
      'Deine Teams und Kinder sind gelöscht, dein Konto selbst noch nicht. Bitte lösche es noch einmal.'
    );
  });

  it('drops what did not fit once another tab switched to another account', async () => {
    const dienst = new FakeKontoDienst();
    dienst.uebrig = { teams: [9001], children: [], clubColors: [] };
    const { knopf, stabil, element } = await oeffnen({ dienst });
    knopf('anmelden')?.click();
    await stabil();
    expect(
      element.querySelector('[data-qa="nicht-uebernommen"]')
    ).not.toBeNull();

    dienst.authMeldet({ uid: 'uid-2', name: 'Familie Beispiel' });
    await stabil();

    expect(element.querySelector('[data-qa="nicht-uebernommen"]')).toBeNull();
  });

  it('says the account is being deleted until the server confirmed it', async () => {
    const dienst = new FakeKontoDienst();
    const seite = await angemeldet(dienst);
    const bestaetigt = Promise.withResolvers<void>();
    dienst.loeschenBestaetigt = bestaetigt.promise;

    seite.knopf('konto-loeschen')?.click();
    await seite.stabil();
    imDialog('konto-loeschen-bestaetigen');
    await seite.stabil();

    expect(
      seite.element
        .querySelector('[data-qa="loeschen-laeuft"]')
        ?.textContent?.trim()
    ).toBe(
      'Das Konto wird gelöscht. Ohne Internet wartet das, bis dein Gerät wieder online ist; lass die App so lange offen.'
    );
    expect(seite.knopf('abmelden')?.disabled).toBe(true);

    bestaetigt.resolve();
    await seite.stabil();
    expect(
      seite.element.querySelector('[data-qa="loeschen-laeuft"]')
    ).toBeNull();
    expect(seite.knopf('anmelden')).not.toBeNull();
  });

  it('says when choices made during sign-in stay on the device for the next start', async () => {
    const dienst = new FakeKontoDienst();
    const lokal = new LocalSelection(undefined);
    let team = 201500;
    dienst.beiJederUebernahme = () => lokal.follow(team++);
    const { knopf, stabil, element } = await oeffnen({ dienst, lokal });

    knopf('anmelden')?.click();
    await stabil();

    expect(
      element.querySelector('[data-qa="geraet-behalten"]')?.textContent?.trim()
    ).toBe(
      'Einige Änderungen dieses Geräts sind noch nicht in deinem Konto. Sie bleiben auf dem Gerät und kommen beim nächsten Öffnen der App dazu.'
    );
  });

  it("tells which of the device's choices did not fit into the account", async () => {
    const dienst = new FakeKontoDienst();
    dienst.uebrig = {
      teams: [9001, 9002],
      children: [{ personId: 4711 }],
      clubColors: [],
    };
    const { knopf, stabil, element } = await oeffnen({ dienst });

    knopf('anmelden')?.click();
    await stabil();

    expect(
      element
        .querySelector('[data-qa="nicht-uebernommen"]')
        ?.textContent?.trim()
    ).toBe(
      '2 Teams und 1 Kind dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens 50 Teams und 20 Kinder.'
    );
  });

  it('says so when the sign-in did not work', async () => {
    const dienst = new FakeKontoDienst();
    dienst.uebernahmeScheitert = true;
    const { knopf, stabil, fehler } = await oeffnen({ dienst });

    knopf('anmelden')?.click();
    await stabil();

    expect(fehler()).toBe(
      'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.'
    );
  });

  it('signs out, back to the sign-in', async () => {
    const { knopf, stabil, dienst } = await angemeldet();

    knopf('abmelden')?.click();
    await stabil();

    expect(dienst.aufrufe).toContain('abmelden');
    expect(knopf('anmelden')).not.toBeNull();
  });

  it('keeps the account where its changes have not been sent, and says so', async () => {
    const dienst = new FakeKontoDienst();
    const seite = await angemeldet(dienst);
    dienst.nichtGesendet = true;

    seite.knopf('abmelden')?.click();
    await seite.stabil();

    expect(seite.fehler()).toBe(
      'Noch sind nicht alle Änderungen bei deinem Konto angekommen. Melde dich ab, sobald du wieder online bist.'
    );
    expect(seite.knopf('abmelden')).not.toBeNull();
  });

  it('deletes the account once confirmed: Google asked first, then its document', async () => {
    const { knopf, stabil, dienst } = await angemeldet();

    knopf('konto-loeschen')?.click();
    await stabil();
    imDialog('konto-loeschen-bestaetigen');
    await stabil();

    expect(dienst.aufrufe.slice(0, 3)).toEqual([
      'erneutAnmelden',
      'auswahlLoeschen uid-1',
      'benutzerLoeschen uid-1',
    ]);
    expect(document.querySelector('korb-konto-loeschen-dialog')).toBeNull();
    expect(knopf('anmelden')).not.toBeNull();
  });

  it('deletes nothing where the Elternteil cancels', async () => {
    const { knopf, stabil, dienst } = await angemeldet();

    knopf('konto-loeschen')?.click();
    await stabil();
    imDialog('abbrechen');
    await stabil();

    expect(dienst.aufrufe).toEqual([]);
    expect(document.querySelector('korb-konto-loeschen-dialog')).toBeNull();
    expect(knopf('abmelden')).not.toBeNull();
  });

  it.each([
    [
      'Google was cancelled',
      (dienst: FakeKontoDienst) => (dienst.abgebrochen = true),
      'Das Konto ist nicht gelöscht: Die Bestätigung bei Google wurde abgebrochen.',
    ],
  ])(
    'says why the account is not deleted where %s',
    async (_, stoeren, text) => {
      const dienst = new FakeKontoDienst();
      const seite = await angemeldet(dienst);
      stoeren(dienst);

      seite.knopf('konto-loeschen')?.click();
      await seite.stabil();
      imDialog('konto-loeschen-bestaetigen');
      await seite.stabil();

      expect(seite.fehler()).toBe(text);
      expect(seite.knopf('abmelden')).not.toBeNull();
    }
  );

  it('deletes nothing offline, and says so', async () => {
    let online = true;
    const seite = await angemeldet(undefined, () => online);
    online = false;

    seite.knopf('konto-loeschen')?.click();
    await seite.stabil();
    imDialog('konto-loeschen-bestaetigen');
    await seite.stabil();

    expect(seite.dienst.aufrufe).toEqual([]);
    expect(seite.fehler()).toBe(
      'Ohne Internet lässt sich das Konto nicht löschen. Bitte versuche es mit Internet noch einmal.'
    );
  });
});

describe('nichtUebernommenText', () => {
  it('says nothing where all fitted', () => {
    expect(
      nichtUebernommenText({ teams: [], children: [], clubColors: [] })
    ).toBeUndefined();
  });

  it('names one Team in the singular', () => {
    expect(
      nichtUebernommenText({ teams: [313036], children: [], clubColors: [] })
    ).toBe(
      '1 Team dieses Geräts passte nicht mehr in dein Konto: Es hält höchstens 50 Teams.'
    );
  });

  it('names Vereinsfarben among the rest, the verb in the plural', () => {
    expect(
      nichtUebernommenText({
        teams: [313036],
        children: [],
        clubColors: [{ clubId: 4242, primary: '#c8102e' }],
      })
    ).toBe(
      '1 Team und die Farben eines Vereins dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens 50 Teams und die Farben von 50 Vereinen.'
    );
    expect(
      nichtUebernommenText({
        teams: [],
        children: [],
        clubColors: [
          { clubId: 4242, primary: '#c8102e' },
          { clubId: 4343, primary: '#1d4ed8' },
        ],
      })
    ).toBe(
      'Die Farben von 2 Vereinen dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens die Farben von 50 Vereinen.'
    );
  });
});
