import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import type { VereinId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  AuswahlVollError,
  type VereinsfarbenWahl,
  type Vereinsfarben,
} from '@wolsok/feat-korbjaeger-auswahl';
import { fakeAuswahl } from '@wolsok/feat-korbjaeger-auswahl/testing';
import {
  VereinsfarbenBlattComponent,
  type VereinsfarbenBlattDaten,
} from './vereinsfarben-blatt.component';

const VEREIN: VereinsfarbenBlattDaten = {
  vereinId: 4242,
  vereinName: 'TSV Muster',
};

async function oeffnen(
  vorhanden: readonly VereinsfarbenWahl[] = [],
  setzen: (verein: VereinId, farben: Vereinsfarben) => Promise<void> = () =>
    Promise.resolve()
) {
  const gesetzt = vi.fn(setzen);
  const zurueckgesetzt = vi.fn(() => Promise.resolve());
  const schliessen = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AUSWAHL,
        useValue: fakeAuswahl({
          vereinsfarben: signal(vorhanden),
          vereinsfarbenSetzen: gesetzt,
          vereinsfarbenZuruecksetzen: zurueckgesetzt,
        }),
      },
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: VEREIN },
      { provide: MatBottomSheetRef, useValue: { dismiss: schliessen } },
    ],
  });
  const fixture = TestBed.createComponent(VereinsfarbenBlattComponent);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  /** A button by its label, or its text where it has none. */
  const benannt = (name: string) => (b: Element) =>
    b.getAttribute('aria-label') === name || b.textContent?.trim() === name;
  const knopf = (name: string) =>
    [...element.querySelectorAll('button')].find(benannt(name));
  const klicken = async (name: string) => {
    knopf(name)?.click();
    await fixture.whenStable();
  };
  /** One colour group's buttons: one radio group each. */
  const inGruppe = (gruppe: string) => [
    ...element.querySelectorAll<HTMLButtonElement>(
      `[data-qa="${gruppe}"] button`
    ),
  ];
  const waehlen = async (gruppe: string, name: string) => {
    inGruppe(gruppe).find(benannt(name))?.click();
    await fixture.whenStable();
  };
  const gewaehlt = (gruppe: string) =>
    inGruppe(gruppe)
      .filter((b) => b.getAttribute('aria-checked') === 'true')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
  return {
    element,
    knopf,
    klicken,
    waehlen,
    gewaehlt,
    gesetzt,
    zurueckgesetzt,
    schliessen,
    fixture,
  };
}

describe('VereinsfarbenBlattComponent', () => {
  it('names the Verein and offers the twelve presets by their names', async () => {
    const { element, knopf } = await oeffnen();

    expect(element.textContent).toContain('TSV Muster');
    for (const name of ['Rot', 'Königsblau', 'Gelb', 'Weiß', 'Grau']) {
      expect(knopf(name)).toBeDefined();
    }
  });

  it('stores the chosen colours for the Verein, and closes', async () => {
    const { klicken, waehlen, knopf, gesetzt, schliessen } = await oeffnen();
    expect(knopf('Übernehmen')?.disabled).toBe(true);

    await waehlen('hauptfarbe', 'Rot');
    await waehlen('zweite-farbe', 'Weiß');
    await klicken('Übernehmen');

    expect(gesetzt).toHaveBeenCalledWith(4242, {
      primaer: '#c8102e',
      zweite: '#ffffff',
    });
    expect(schliessen).toHaveBeenCalled();
  });

  it('starts from the colours the Verein has, a second one left out', async () => {
    const { gewaehlt, waehlen, klicken, gesetzt } = await oeffnen([
      { vereinId: 4242, primaer: '#007a3d', zweite: '#ffd700' },
    ]);
    expect(gewaehlt('hauptfarbe')).toEqual(['Grün']);
    expect(gewaehlt('zweite-farbe')).toEqual(['Gelb']);

    await waehlen('zweite-farbe', 'Keine');
    await klicken('Übernehmen');

    expect(gesetzt).toHaveBeenCalledWith(4242, { primaer: '#007a3d' });
  });

  it('takes an own colour from the colour picker', async () => {
    const { element, fixture, klicken, gesetzt } = await oeffnen();
    const eigene = element.querySelector<HTMLInputElement>(
      '[data-qa="hauptfarbe"] input[type="color"]'
    );

    eigene!.value = '#123456';
    eigene!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    await klicken('Übernehmen');

    expect(gesetzt).toHaveBeenCalledWith(4242, { primaer: '#123456' });
  });

  it("resets the Verein's colours, offered only where it has some", async () => {
    const ohne = await oeffnen();
    expect(ohne.knopf('Zurücksetzen')).toBeUndefined();
    TestBed.resetTestingModule();

    const { klicken, zurueckgesetzt, schliessen } = await oeffnen([
      { vereinId: 4242, primaer: '#c8102e' },
    ]);
    await klicken('Zurücksetzen');

    expect(zurueckgesetzt).toHaveBeenCalledWith(4242);
    expect(schliessen).toHaveBeenCalled();
  });

  it('says why the colours were not stored, and stays open', async () => {
    const { element, waehlen, klicken, schliessen } = await oeffnen([], () =>
      Promise.reject(new AuswahlVollError('vereinsfarben'))
    );

    await waehlen('hauptfarbe', 'Rot');
    await klicken('Übernehmen');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Vereinen Farben gegeben'
    );
    expect(schliessen).not.toHaveBeenCalled();
  });

  it('writes once for a double tap, its buttons waiting for the change', async () => {
    let fertig!: () => void;
    const { waehlen, knopf, fixture, gesetzt } = await oeffnen(
      [],
      () => new Promise<void>((resolve) => (fertig = resolve))
    );
    await waehlen('hauptfarbe', 'Rot');

    knopf('Übernehmen')?.click();
    knopf('Übernehmen')?.click();
    await fixture.whenStable();

    expect(gesetzt).toHaveBeenCalledTimes(1);
    expect(knopf('Übernehmen')?.disabled).toBe(true);
    fertig();
  });

  it('closes without a change on "Abbrechen"', async () => {
    const { waehlen, klicken, gesetzt, schliessen } = await oeffnen();

    await waehlen('hauptfarbe', 'Rot');
    await klicken('Abbrechen');

    expect(gesetzt).not.toHaveBeenCalled();
    expect(schliessen).toHaveBeenCalled();
  });

  it('shows the choice in its preview', async () => {
    const { element, waehlen } = await oeffnen();
    const vorschau = element.querySelector<HTMLElement>(
      '[data-qa="vorschau"]'
    )!;

    await waehlen('hauptfarbe', 'Rot');
    await new Promise((fertig) => setTimeout(fertig));

    expect(vorschau.style.getPropertyValue('--mat-sys-primary')).toContain(
      'light-dark('
    );
  });
});
