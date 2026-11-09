import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { EinstellungenComponent } from './einstellungen.component';
import { KONTO_SITZUNG } from './konto';
import { KontoSitzung } from './konto-sitzung';
import { FakeKontoDienst, MerkerImSpec } from './testing/fake-konto-dienst';

interface Seite {
  readonly element: HTMLElement;
  readonly dienst: FakeKontoDienst;
  readonly stabil: () => Promise<void>;
  readonly knopf: (qa: string) => HTMLButtonElement | null;
  readonly fehler: () => string | undefined;
}

async function oeffnen(
  optionen: { ohneAnmeldung?: boolean; dienst?: FakeKontoDienst } = {}
): Promise<Seite> {
  const dienst = optionen.dienst ?? new FakeKontoDienst();
  const sitzung = new KontoSitzung(
    new LokaleAuswahl(undefined),
    optionen.ohneAnmeldung ? undefined : async () => dienst,
    new MerkerImSpec()
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
    stabil,
    knopf: (qa) =>
      element.querySelector<HTMLButtonElement>(`[data-qa="${qa}"]`),
    fehler: () =>
      element.querySelector('.fehler[role="alert"]')?.textContent?.trim(),
  };
}

async function angemeldet(dienst?: FakeKontoDienst): Promise<Seite> {
  const seite = await oeffnen({ dienst });
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

  it('deletes the account once confirmed, its document first', async () => {
    const { knopf, stabil, dienst } = await angemeldet();

    knopf('konto-loeschen')?.click();
    await stabil();
    imDialog('konto-loeschen-bestaetigen');
    await stabil();

    expect(dienst.aufrufe.slice(0, 2)).toEqual([
      'auswahlLoeschen uid-1',
      'benutzerLoeschen',
    ]);
    expect(knopf('anmelden')).not.toBeNull();
  });

  it('deletes nothing where the Elternteil cancels', async () => {
    const { knopf, stabil, dienst } = await angemeldet();

    knopf('konto-loeschen')?.click();
    await stabil();
    imDialog('abbrechen');
    await stabil();

    expect(dienst.aufrufe).toEqual([]);
    expect(knopf('abmelden')).not.toBeNull();
  });

  it('says so where the account could not be deleted', async () => {
    const dienst = new FakeKontoDienst();
    const seite = await angemeldet(dienst);
    dienst.frischAnmelden = true;
    dienst.abgebrochen = true;

    seite.knopf('konto-loeschen')?.click();
    await seite.stabil();
    imDialog('konto-loeschen-bestaetigen');
    await seite.stabil();

    expect(seite.fehler()).toBe(
      'Das Konto ist noch nicht gelöscht. Bitte noch einmal versuchen.'
    );
    expect(seite.knopf('abmelden')).not.toBeNull();
  });
});
