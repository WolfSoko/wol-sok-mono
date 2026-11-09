import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ThemeService } from '@wolsok/shared-theme';
import { DARSTELLUNG_SCHLUESSEL } from '../geraete-speicher';
import { provideDarstellung } from './darstellung';
import { DarstellungWahlComponent } from './darstellung-wahl.component';

interface Wahl {
  readonly element: HTMLElement;
  readonly stabil: () => void;
  readonly option: (wert: string) => HTMLButtonElement;
}

function oeffnen(): Wahl {
  TestBed.configureTestingModule({
    providers: [
      provideDarstellung(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(DarstellungWahlComponent);
  const element = fixture.nativeElement as HTMLElement;
  const stabil = (): void => {
    TestBed.tick();
    fixture.detectChanges();
  };
  stabil();
  return {
    element,
    stabil,
    option: (wert) => {
      const knopf = element.querySelector<HTMLButtonElement>(
        `[data-qa="darstellung-${wert}"] button`
      );
      if (!knopf) {
        throw new Error(`no option ${wert}`);
      }
      return knopf;
    },
  };
}

describe('DarstellungWahlComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers System, Hell and Dunkel in German, System by default', () => {
    const { element, option } = oeffnen();

    const optionen = [...element.querySelectorAll('mat-button-toggle')].map(
      (toggle) => toggle.textContent?.trim()
    );
    expect(optionen).toEqual(['System', 'Hell', 'Dunkel']);
    expect(
      element
        .querySelector('mat-button-toggle-group')
        ?.getAttribute('aria-label')
    ).toBe('Darstellung');
    expect(option('system').getAttribute('aria-checked')).toBe('true');
  });

  it('applies and keeps the look chosen', () => {
    const { option, stabil } = oeffnen();

    option('dark').click();
    stabil();

    expect(TestBed.inject(ThemeService).choice()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBe('dark');
    expect(option('dark').getAttribute('aria-checked')).toBe('true');

    option('system').click();
    stabil();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBeNull();
  });

  it('shows the look kept on the device', () => {
    localStorage.setItem(DARSTELLUNG_SCHLUESSEL, 'light');

    const { option } = oeffnen();

    expect(option('light').getAttribute('aria-checked')).toBe('true');
  });
});
