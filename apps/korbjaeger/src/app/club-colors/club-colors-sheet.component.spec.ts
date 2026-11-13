import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  SelectionFullError,
  type ClubColorsChoice,
  type ClubColors,
} from '@wolsok/feat-korbjaeger-selection';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import {
  ClubColorsSheetComponent,
  type ClubColorsSheetData,
} from './club-colors-sheet.component';

const CLUB: ClubColorsSheetData = {
  clubId: 4242,
  clubName: 'TSV Muster',
};

async function openSheet(
  vorhanden: readonly ClubColorsChoice[] = [],
  setzen: (club: ClubId, colors: ClubColors) => Promise<void> = () =>
    Promise.resolve()
) {
  const set = vi.fn(setzen);
  const reset = vi.fn(() => Promise.resolve());
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AUSWAHL,
        useValue: fakeSelection({
          clubColors: signal(vorhanden),
          setClubColors: set,
          resetClubColors: reset,
        }),
      },
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: CLUB },
      { provide: MatBottomSheetRef, useValue: { dismiss: close } },
    ],
  });
  const fixture = TestBed.createComponent(ClubColorsSheetComponent);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  /** A button by its label, or its text where it has none. */
  const benannt = (name: string) => (b: Element) =>
    b.getAttribute('aria-label') === name || b.textContent?.trim() === name;
  const button = (name: string) =>
    [...element.querySelectorAll('button')].find(benannt(name));
  const click = async (name: string) => {
    button(name)?.click();
    await fixture.whenStable();
  };
  /** One colour group's buttons: one radio group each. */
  const inGruppe = (gruppe: string) => [
    ...element.querySelectorAll<HTMLButtonElement>(
      `[data-qa="${gruppe}"] button`
    ),
  ];
  const choose = async (gruppe: string, name: string) => {
    inGruppe(gruppe).find(benannt(name))?.click();
    await fixture.whenStable();
  };
  const chosen = (gruppe: string) =>
    inGruppe(gruppe)
      .filter((b) => b.getAttribute('aria-checked') === 'true')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
  return {
    element,
    button,
    click,
    choose,
    chosen,
    set,
    reset,
    close,
    fixture,
  };
}

describe('ClubColorsSheetComponent', () => {
  it('names the Verein and offers the twelve presets by their names', async () => {
    const { element, button } = await openSheet();

    expect(element.textContent).toContain('TSV Muster');
    for (const name of ['Rot', 'Königsblau', 'Gelb', 'Weiß', 'Grau']) {
      expect(button(name)).toBeDefined();
    }
  });

  it('stores the chosen colours for the Verein, and closes', async () => {
    const { click, choose, button, set, close: closeSheet } = await openSheet();
    expect(button('Übernehmen')?.disabled).toBe(true);

    await choose('primary-color', 'Rot');
    await choose('secondary-color', 'Weiß');
    await click('Übernehmen');

    expect(set).toHaveBeenCalledWith(4242, {
      primary: '#c8102e',
      secondary: '#ffffff',
    });
    expect(closeSheet).toHaveBeenCalled();
  });

  it('starts from the colours the Verein has, a second one left out', async () => {
    const { chosen, choose, click, set } = await openSheet([
      { clubId: 4242, primary: '#007a3d', secondary: '#ffd700' },
    ]);
    expect(chosen('primary-color')).toEqual(['Grün']);
    expect(chosen('secondary-color')).toEqual(['Gelb']);

    await choose('secondary-color', 'Keine');
    await click('Übernehmen');

    expect(set).toHaveBeenCalledWith(4242, { primary: '#007a3d' });
  });

  it('takes an own colour from the colour picker', async () => {
    const { element, fixture, click, set } = await openSheet();
    const eigene = element.querySelector<HTMLInputElement>(
      '[data-qa="primary-color"] input[type="color"]'
    );

    eigene!.value = '#123456';
    eigene!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    await click('Übernehmen');

    expect(set).toHaveBeenCalledWith(4242, { primary: '#123456' });
  });

  it("resets the Verein's colours, offered only where it has some", async () => {
    const without = await openSheet();
    expect(without.button('Zurücksetzen')).toBeUndefined();
    TestBed.resetTestingModule();

    const {
      click,
      reset,
      close: closeSheet,
    } = await openSheet([{ clubId: 4242, primary: '#c8102e' }]);
    await click('Zurücksetzen');

    expect(reset).toHaveBeenCalledWith(4242);
    expect(closeSheet).toHaveBeenCalled();
  });

  it('says why the colours were not stored, and stays open', async () => {
    const {
      element,
      choose,
      click,
      close: closeSheet,
    } = await openSheet([], () =>
      Promise.reject(new SelectionFullError('clubColors'))
    );

    await choose('primary-color', 'Rot');
    await click('Übernehmen');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Vereinen Farben gegeben'
    );
    expect(closeSheet).not.toHaveBeenCalled();
  });

  it('writes once for a double tap, its buttons waiting for the change', async () => {
    let done!: () => void;
    const { choose, button, fixture, set } = await openSheet(
      [],
      () => new Promise<void>((resolve) => (done = resolve))
    );
    await choose('primary-color', 'Rot');

    button('Übernehmen')?.click();
    button('Übernehmen')?.click();
    await fixture.whenStable();

    expect(set).toHaveBeenCalledTimes(1);
    expect(button('Übernehmen')?.disabled).toBe(true);
    done();
  });

  it('closes without a change on "Abbrechen"', async () => {
    const { choose, click, set, close: closeSheet } = await openSheet();

    await choose('primary-color', 'Rot');
    await click('Abbrechen');

    expect(set).not.toHaveBeenCalled();
    expect(closeSheet).toHaveBeenCalled();
  });

  it('shows the choice in its preview', async () => {
    const { element, choose } = await openSheet();
    const preview = element.querySelector<HTMLElement>('[data-qa="preview"]')!;

    await choose('primary-color', 'Rot');
    await new Promise((done) => setTimeout(done));

    expect(preview.style.getPropertyValue('--mat-sys-primary')).toContain(
      'light-dark('
    );
  });
});
