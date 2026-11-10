import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { VereinId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeAuswahl } from '@wolsok/feat-korbjaeger-auswahl/testing';
import type {
  VereinsfarbenWahl,
  Vereinsfarben,
} from '@wolsok/feat-korbjaeger-auswahl';
import { farbschemaTokens } from './farbschema';
import {
  FarbschemaDirective,
  vereinsfarbenAnwenden,
} from './vereinsfarben-anwenden';

/** A component wearing a Verein's colours, as the Team page does. */
@Component({ selector: 'korb-im-verein', template: '' })
class ImVerein {
  public readonly verein = input<VereinId | undefined>();

  public constructor() {
    vereinsfarbenAnwenden(this.verein);
  }
}

@Component({
  imports: [ImVerein, FarbschemaDirective],
  template: `
    <korb-im-verein data-qa="verein" [verein]="verein()" />
    <section data-qa="vorschau" [korbFarbschema]="farben()"></section>
  `,
})
class Seite {
  public readonly verein = signal<VereinId | undefined>(4242);
  public readonly farben = signal<Vereinsfarben | undefined>(undefined);
}

const ROT: VereinsfarbenWahl = { vereinId: 4242, primaer: '#c8102e' };

async function oeffnen(vereinsfarben: readonly VereinsfarbenWahl[] = [ROT]) {
  const farben = signal<readonly VereinsfarbenWahl[] | undefined>(
    vereinsfarben
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: AUSWAHL, useValue: fakeAuswahl({ vereinsfarben: farben }) },
    ],
  });
  const fixture = TestBed.createComponent(Seite);
  const stabil = async () => {
    await fixture.whenStable();
    // the scheme loads in a chunk of its own
    await new Promise((fertig) => setTimeout(fertig));
    await fixture.whenStable();
  };
  await stabil();
  const teil = (qa: string) =>
    fixture.nativeElement.querySelector(`[data-qa="${qa}"]`) as HTMLElement;
  return { fixture, farben, stabil, teil };
}

const PRIMAER = '--mat-sys-primary';

describe('vereinsfarbenAnwenden', () => {
  it("sets every system colour of the Verein's colours, light and dark", async () => {
    const { teil } = await oeffnen();

    const tokens = farbschemaTokens(ROT);
    const stil = teil('verein').style;
    for (const [name, wert] of Object.entries(tokens)) {
      expect(stil.getPropertyValue(name)).toBe(wert);
    }
  });

  it('sets nothing for a Verein without colours, the app’s own applying', async () => {
    const { teil } = await oeffnen([]);

    expect(teil('verein').style.getPropertyValue(PRIMAER)).toBe('');
  });

  it('takes the colours away once they are reset', async () => {
    const { farben, stabil, teil } = await oeffnen();

    farben.set([]);
    await stabil();

    expect(teil('verein').style.length).toBe(0);
  });

  it('keeps the colours while they are read again, so the page does not flash', async () => {
    const { farben, stabil, teil } = await oeffnen();
    const vorher = teil('verein').style.getPropertyValue(PRIMAER);

    // a sign-in switches stores: nothing read for a moment
    farben.set(undefined);
    await stabil();

    expect(teil('verein').style.getPropertyValue(PRIMAER)).toBe(vorher);
  });

  it('follows another Verein, and a change of the colours', async () => {
    const { fixture, farben, stabil, teil } = await oeffnen();

    farben.set([ROT, { vereinId: 4343, primaer: '#1d4ed8' }]);
    fixture.componentInstance.verein.set(4343);
    await stabil();

    expect(teil('verein').style.getPropertyValue(PRIMAER)).toBe(
      farbschemaTokens({ primaer: '#1d4ed8' })[PRIMAER]
    );
  });
});

describe('FarbschemaDirective', () => {
  it('sets the colours it is given, and none without', async () => {
    const { fixture, stabil, teil } = await oeffnen();
    expect(teil('vorschau').style.length).toBe(0);

    fixture.componentInstance.farben.set({ primaer: '#007a3d' });
    await stabil();

    expect(teil('vorschau').style.getPropertyValue(PRIMAER)).toBe(
      farbschemaTokens({ primaer: '#007a3d' })[PRIMAER]
    );
  });
});
