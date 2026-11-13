import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { SELECTION } from '../selection/selection';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import { ChildMarkComponent } from './child-mark.component';

describe('ChildMarkComponent', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('says itself why a mark failed where no page shows it', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SELECTION,
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
    const fixture = TestBed.createComponent(ChildMarkComponent);
    fixture.componentRef.setInput('player', {
      kind: 'named',
      personId: 4711,
    });
    fixture.componentRef.setInput('name', 'Lumi Ahornwiese');
    const settled = async (): Promise<void> => {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };
    await settled();
    const page = fixture.nativeElement as HTMLElement;

    page.querySelector<HTMLButtonElement>('[data-qa="child-mark"]')?.click();
    await settled();
    document
      .querySelector<HTMLFormElement>('korb-nickname-dialog form')
      ?.requestSubmit();
    await settled();

    expect(page.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });
});
