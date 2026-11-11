import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import type { TeamKarte } from './team-karte';
import { UeberblickTeamComponent } from './ueberblick-team.component';

const GELADEN: TeamKarte = {
  art: 'geladen',
  teamId: 313036,
  name: 'MTV Wasbüttel',
  verein: { id: 4242, name: 'MTV Wasbüttel' },
  ausfaelle: [],
  saisonBeendet: false,
};

async function zeigen(karte: TeamKarte): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AUSWAHL,
        useValue: fakeSelection({
          clubColors: signal([{ clubId: 4242, primary: '#007a3d' }]),
        }),
      },
    ],
  });
  const fixture = TestBed.createComponent(UeberblickTeamComponent);
  fixture.componentRef.setInput('karte', karte);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const vereinsfarbenKnopf = (element: HTMLElement) =>
  element.querySelector('[data-qa="vereinsfarben"]');

describe('UeberblickTeamComponent', () => {
  it("wears its Verein's colours, and offers them named after the Verein", async () => {
    const element = await zeigen(GELADEN);

    // the colour maths loads in a chunk of its own
    await vi.waitFor(() =>
      expect(element.style.getPropertyValue('--mat-sys-primary')).toContain(
        'light-dark('
      )
    );
    expect(vereinsfarbenKnopf(element)?.getAttribute('aria-label')).toBe(
      'Vereinsfarben von MTV Wasbüttel'
    );
  });

  it('wears the app’s own colours and offers none while the Team loads or failed', async () => {
    for (const karte of [
      { art: 'laedt', teamId: 313036 },
      { art: 'fehler', teamId: 313036, text: 'Kein Internet.' },
    ] as const satisfies readonly TeamKarte[]) {
      TestBed.resetTestingModule();
      const element = await zeigen(karte);
      // the colour maths' chunk loaded: anything it would set is set
      await import('../vereinsfarben/farbschema');
      await new Promise((fertig) => setTimeout(fertig));

      expect(element.style.getPropertyValue('--mat-sys-primary')).toBe('');
      expect(vereinsfarbenKnopf(element)).toBeNull();
    }
  });
});
