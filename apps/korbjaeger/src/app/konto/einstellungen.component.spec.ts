import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
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
  } = {}
): Promise<Seite> {
  const dienst = optionen.dienst ?? new FakeKontoDienst();
  let ladevorgaenge = 0;
  const sitzung = new KontoSitzung(
    new LokaleAuswahl(undefined),
    optionen.ohneAnmeldung
      ? undefined
      : async () => {
          ladevorgaenge++;
          return dienst;
        },
    new MerkerImSpec(),
    optionen.online
  );
  await sitzung.starten();
  TestBed.configureTestingModule({
    providers: [
      { provide: KONTO_SITZUNG, useValue: sitzung },
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

  it('has nothing to set where the build offers no sign-in', async () => {
    const { element, knopf } = await oeffnen({ ohneAnmeldung: true });

    expect(element.textContent).toContain(
      'Hier gibt es noch nichts einzustellen.'
    );
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

  it("tells which of the device's choices did not fit into the account", async () => {
    const dienst = new FakeKontoDienst();
    dienst.uebrig = { teams: 2, kinder: 1 };
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
      'benutzerLoeschen',
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
    [
      'the server did not confirm it',
      (dienst: FakeKontoDienst) => (dienst.loeschenOhneServer = true),
      'Ohne Internet lässt sich das Konto nicht löschen. Bitte versuche es mit Internet noch einmal.',
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
    expect(nichtUebernommenText({ teams: 0, kinder: 0 })).toBeUndefined();
  });

  it('names one Team in the singular', () => {
    expect(nichtUebernommenText({ teams: 1, kinder: 0 })).toBe(
      '1 Team dieses Geräts passte nicht mehr in dein Konto: Es hält höchstens 50 Teams und 20 Kinder.'
    );
  });
});
