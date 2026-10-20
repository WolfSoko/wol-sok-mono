import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CampaignSummary } from '../state/campaign';
import { MainMenuComponent } from './main-menu.component';

const CAMPAIGN: CampaignSummary = {
  openLevels: 5,
  medals: { bronze: 2, silver: 4, gold: 3, platinum: 0 },
  achievements: 5,
  xp: 1000,
  continueLabel: '5 · Pillar Field · Normal',
};

describe('MainMenuComponent', () => {
  let fixture: ComponentFixture<MainMenuComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  function button(text: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text)
    );
    if (found == null) {
      throw new Error(`no button "${text}"`);
    }
    return found;
  }

  it('shows the campaign so far', () => {
    const card = host.querySelector('.card')?.textContent ?? '';
    expect(card).toContain('5 of 14 levels open');
    expect(card).toContain('9 of 42');
    expect(card).toContain('5 · Pillar Field · Normal');
  });

  it('reports what the player picks', () => {
    const play = jest.fn();
    const open = jest.fn();
    const resume = jest.fn();
    fixture.componentInstance.play.subscribe(play);
    fixture.componentInstance.open.subscribe(open);
    fixture.componentInstance.continueCampaign.subscribe(resume);

    button('Play').click();
    button('Two players').click();
    button('Profile').click();
    button('Settings').click();
    button('How to play').click();
    button('Continue the campaign').click();

    expect(play.mock.calls).toEqual([['vs-computer'], ['two-players']]);
    expect(open.mock.calls).toEqual([['profile'], ['settings'], ['help']]);
    expect(resume).toHaveBeenCalled();
  });

  it('mutes, unmutes and leaves for the page', () => {
    const sound = jest.fn();
    const leave = jest.fn();
    fixture.componentInstance.soundChange.subscribe(sound);
    fixture.componentInstance.leave.subscribe(leave);

    host.querySelector<HTMLButtonElement>('[aria-label="Mute"]')?.click();
    host
      .querySelector<HTMLButtonElement>('[aria-label="Back to the page"]')
      ?.click();

    expect(sound).toHaveBeenCalledWith(false);
    expect(leave).toHaveBeenCalled();
  });

  it('offers the daily level with its attempts and streak', () => {
    fixture.componentRef.setInput('daily', {
      name: 'Hungry Locks',
      note: '2 of 3 attempts left · 4-day streak',
    });
    fixture.detectChanges();
    const daily = jest.fn();
    fixture.componentInstance.playDaily.subscribe(daily);

    const card = button('Daily level');
    card.click();

    expect(card.textContent).toContain('Hungry Locks');
    expect(card.textContent).toContain('4-day streak');
    expect(daily).toHaveBeenCalled();
  });

  it('leaves the daily level out without one', () => {
    expect(host.textContent).not.toContain('Daily level');
  });

  it('offers an endless run with the best one so far', () => {
    fixture.componentRef.setInput('endlessBest', 7);
    fixture.detectChanges();
    const endless = jest.fn();
    fixture.componentInstance.playEndless.subscribe(endless);

    const card = button('Endless run');
    card.click();

    expect(card.textContent).toContain('best 7');
    expect(endless).toHaveBeenCalled();
  });
});
