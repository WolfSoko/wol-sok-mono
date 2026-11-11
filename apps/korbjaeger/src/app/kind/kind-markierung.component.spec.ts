import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import { KindMarkierungComponent } from './kind-markierung.component';

describe('KindMarkierungComponent', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('says itself why a mark failed where no page shows it', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUSWAHL,
          useValue: fakeSelection({
            mark: () => Promise.reject(new Error('voll')),
          }),
        },
        {
          provide: MATERIAL_ANIMATIONS,
          useValue: { animationsDisabled: true },
        },
      ],
    });
    const fixture = TestBed.createComponent(KindMarkierungComponent);
    fixture.componentRef.setInput('spieler', {
      kind: 'named',
      personId: 4711,
    });
    fixture.componentRef.setInput('name', 'Lumi Ahornwiese');
    const stabil = async (): Promise<void> => {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };
    await stabil();
    const seite = fixture.nativeElement as HTMLElement;

    seite
      .querySelector<HTMLButtonElement>('[data-qa="kind-markieren"]')
      ?.click();
    await stabil();
    document
      .querySelector<HTMLFormElement>('korb-spitzname-dialog form')
      ?.requestSubmit();
    await stabil();

    expect(seite.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });
});
