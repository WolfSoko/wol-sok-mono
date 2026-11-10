import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ThemeService } from '@wolsok/shared-theme';
import { DARSTELLUNG_SCHLUESSEL } from '../geraete-speicher';
import { provideDarstellung } from './darstellung';
import { DarstellungWahlComponent } from './darstellung-wahl.component';

async function oeffnen(): Promise<MatButtonToggleGroupHarness> {
  TestBed.configureTestingModule({
    providers: [
      provideDarstellung(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(DarstellungWahlComponent);
  return TestbedHarnessEnvironment.loader(fixture).getHarness(
    MatButtonToggleGroupHarness.with({ selector: '[aria-label="Darstellung"]' })
  );
}

async function gewaehlt(
  gruppe: MatButtonToggleGroupHarness
): Promise<string[]> {
  const gewaehlte: string[] = [];
  for (const option of await gruppe.getToggles()) {
    if (await option.isChecked()) {
      gewaehlte.push(await option.getText());
    }
  }
  return gewaehlte;
}

describe('DarstellungWahlComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers System, Hell and Dunkel in German, System by default', async () => {
    const gruppe = await oeffnen();

    const namen = await Promise.all(
      (await gruppe.getToggles()).map((option) => option.getText())
    );
    expect(namen).toEqual(['System', 'Hell', 'Dunkel']);
    expect(await gewaehlt(gruppe)).toEqual(['System']);
  });

  it('applies and keeps the look chosen', async () => {
    const gruppe = await oeffnen();

    await (await gruppe.getToggles({ text: 'Dunkel' }))[0].check();

    expect(TestBed.inject(ThemeService).choice()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBe('dark');
    expect(await gewaehlt(gruppe)).toEqual(['Dunkel']);

    await (await gruppe.getToggles({ text: 'System' }))[0].check();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBeNull();
  });

  it('shows the look kept on the device', async () => {
    localStorage.setItem(DARSTELLUNG_SCHLUESSEL, 'light');

    expect(await gewaehlt(await oeffnen())).toEqual(['Hell']);
  });
});
