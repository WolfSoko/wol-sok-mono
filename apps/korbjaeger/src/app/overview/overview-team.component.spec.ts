import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import type { TeamCard } from './team-card';
import { OverviewTeamComponent } from './overview-team.component';

const LOADED: TeamCard = {
  kind: 'loaded',
  teamId: 313036,
  name: 'MTV Wasbüttel',
  club: { id: 4242, name: 'MTV Wasbüttel' },
  cancellations: [],
  seasonOver: false,
};

async function show(card: TeamCard): Promise<HTMLElement> {
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
  const fixture = TestBed.createComponent(OverviewTeamComponent);
  fixture.componentRef.setInput('card', card);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const clubColorsButton = (element: HTMLElement) =>
  element.querySelector('[data-qa="club-colors"]');

describe('OverviewTeamComponent', () => {
  it("wears its Verein's colours, and offers them named after the Verein", async () => {
    const element = await show(LOADED);

    // the colour maths loads in a chunk of its own
    await vi.waitFor(() =>
      expect(element.style.getPropertyValue('--mat-sys-primary')).toContain(
        'light-dark('
      )
    );
    expect(clubColorsButton(element)?.getAttribute('aria-label')).toBe(
      'Vereinsfarben von MTV Wasbüttel'
    );
  });

  it('wears the app’s own colours and offers none while the Team loads or failed', async () => {
    for (const card of [
      { kind: 'loading', teamId: 313036 },
      { kind: 'error', teamId: 313036, text: 'Kein Internet.' },
    ] as const satisfies readonly TeamCard[]) {
      TestBed.resetTestingModule();
      const element = await show(card);
      // the colour maths' chunk loaded: anything it would set is set
      await import('../club-colors/color-scheme');
      await new Promise((done) => setTimeout(done));

      expect(element.style.getPropertyValue('--mat-sys-primary')).toBe('');
      expect(clubColorsButton(element)).toBeNull();
    }
  });
});
