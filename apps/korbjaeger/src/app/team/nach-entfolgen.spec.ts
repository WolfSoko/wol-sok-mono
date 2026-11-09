import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { fakeAuswahl } from '../auswahl/testing/fake-auswahl';
import { FokusNachEntfolgenDirective } from './fokus-nach-entfolgen.directive';
import { NachEntfolgen } from './nach-entfolgen';

@Component({
  imports: [FokusNachEntfolgenDirective],
  providers: [NachEntfolgen],
  template: `
    <h2 korbFokusNachEntfolgen tabindex="-1">Meine Teams</h2>
    <button type="button" [korbFokusNachEntfolgen]="313036">Wasbüttel</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Bildschirm {}

interface Aufbau {
  readonly nachEntfolgen: NachEntfolgen;
  readonly leisten: HarnessLoader;
  readonly stabil: () => Promise<void>;
}

async function render(
  auswahl: Auswahl = new LokaleAuswahl(undefined)
): Promise<Aufbau> {
  TestBed.configureTestingModule({
    providers: [{ provide: AUSWAHL, useValue: auswahl }],
  });
  const fixture = TestBed.createComponent(Bildschirm);
  await fixture.whenStable();
  return {
    nachEntfolgen: fixture.debugElement.injector.get(NachEntfolgen),
    leisten: TestbedHarnessEnvironment.documentRootLoader(fixture),
    stabil: () => fixture.whenStable(),
  };
}

describe('NachEntfolgen', () => {
  afterEach(() => TestBed.inject(MatSnackBar).dismiss());

  it("moves focus to the Team's own target", async () => {
    const { nachEntfolgen } = await render();

    nachEntfolgen.entfolgt(313036, 'MTV Wasbüttel');

    expect(document.activeElement?.textContent).toBe('Wasbüttel');
  });

  it("moves focus to the screen's target for a Team without one", async () => {
    const { nachEntfolgen } = await render();

    nachEntfolgen.entfolgt(201500, 'MTV Gifhorn');

    expect(document.activeElement?.textContent).toBe('Meine Teams');
  });

  it('follows the Team again at the place it had', async () => {
    const folgen = vi.fn<Auswahl['folgen']>(() => Promise.resolve());
    const { nachEntfolgen, leisten } = await render(fakeAuswahl({ folgen }));

    nachEntfolgen.entfolgt(313036, 'MTV Wasbüttel', { seit: 5 });
    await (await leisten.getHarness(MatSnackBarHarness)).dismissWithAction();

    expect(folgen).toHaveBeenCalledWith(313036, { seit: 5 });
  });

  it('takes the undo back once another store holds the choices (signed in or out elsewhere)', async () => {
    const quelle = signal<object>({ art: 'konto' });
    const folgen = vi.fn<Auswahl['folgen']>(() => Promise.resolve());
    const { nachEntfolgen, leisten, stabil } = await render(
      fakeAuswahl({ quelle, folgen })
    );
    nachEntfolgen.entfolgt(313036, 'MTV Wasbüttel');
    expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).not.toBeNull();

    quelle.set({ art: 'geraet' });
    await stabil();

    expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    expect(folgen).not.toHaveBeenCalled();
  });

  it('follows nobody where "Rückgängig" comes after the switch, before the snackbar went', async () => {
    const quelle = signal<object>({ art: 'konto' });
    const folgen = vi.fn<Auswahl['folgen']>(() => Promise.resolve());
    const { nachEntfolgen, leisten } = await render(
      fakeAuswahl({ quelle, folgen })
    );
    nachEntfolgen.entfolgt(313036, 'MTV Wasbüttel');
    // queried by hand: a harness would wait for the page, running the effect
    const aktion = document.querySelector<HTMLButtonElement>(
      'mat-snack-bar-container button'
    );
    expect(aktion).not.toBeNull();

    // the same tick: no effect has run yet
    quelle.set({ art: 'geraet' });
    aktion?.click();

    expect(folgen).not.toHaveBeenCalled();
    expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
  });
});
