import { I18nService } from '../i18n/i18n.service';
import { TestBed } from '@angular/core/testing';
import { LEVELS } from '../state/levels';
import { GhostChallengeComponent } from './ghost-challenge.component';

describe('GhostChallengeComponent', () => {
  it('names the level of the shared run and reports the answer', () => {
    const fixture = TestBed.createComponent(GhostChallengeComponent);
    fixture.componentRef.setInput('level', LEVELS[2]);
    const fight = jest.fn();
    const dismiss = jest.fn();
    fixture.componentInstance.fight.subscribe(fight);
    fixture.componentInstance.dismiss.subscribe(dismiss);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain(LEVELS[2].name);
    const [fightButton, dismissButton] = Array.from(
      host.querySelectorAll('button')
    );
    fightButton.click();
    dismissButton.click();

    expect(fight).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalled();
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(GhostChallengeComponent);
    fixture.componentRef.setInput('level', LEVELS[2]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jetzt nicht');
  });
});
