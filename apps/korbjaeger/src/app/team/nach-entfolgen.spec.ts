import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { AUSWAHL } from '../auswahl/auswahl';
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

async function render(): Promise<NachEntfolgen> {
  TestBed.configureTestingModule({
    providers: [{ provide: AUSWAHL, useValue: new LokaleAuswahl(undefined) }],
  });
  const fixture = TestBed.createComponent(Bildschirm);
  await fixture.whenStable();
  return fixture.debugElement.injector.get(NachEntfolgen);
}

describe('NachEntfolgen', () => {
  afterEach(() => TestBed.inject(MatSnackBar).dismiss());

  it("moves focus to the Team's own target", async () => {
    const nachEntfolgen = await render();

    nachEntfolgen.entfolgt(313036, 'MTV Wasbüttel');

    expect(document.activeElement?.textContent).toBe('Wasbüttel');
  });

  it("moves focus to the screen's target for a Team without one", async () => {
    const nachEntfolgen = await render();

    nachEntfolgen.entfolgt(201500, 'MTV Gifhorn');

    expect(document.activeElement?.textContent).toBe('Meine Teams');
  });
});
