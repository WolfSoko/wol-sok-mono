import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdSlotComponent } from './ad-slot.component';
import { GameAds } from './game-ads.service';

describe('AdSlotComponent', () => {
  let consentAnswered: ReturnType<typeof signal<boolean>>;
  let remove: jest.Mock;
  let show: jest.Mock<() => void, [HTMLElement]>;

  beforeEach(() => {
    consentAnswered = signal(false);
    remove = jest.fn();
    show = jest.fn(() => remove);
    TestBed.configureTestingModule({
      providers: [{ provide: GameAds, useValue: { consentAnswered, show } }],
    });
  });

  it('takes no room and asks for no ad before the consent is answered', async () => {
    const fixture = TestBed.createComponent(AdSlotComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.children).toHaveLength(0);
    expect(show).not.toHaveBeenCalled();
  });

  it('shows an ad under its label once the consent is answered', async () => {
    const fixture = TestBed.createComponent(AdSlotComponent);
    await fixture.whenStable();

    consentAnswered.set(true);
    await fixture.whenStable();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.label')?.textContent).toBe('Ad');
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0].parentElement).toBe(host);
  });

  it('takes the ad out with the screen', async () => {
    consentAnswered.set(true);
    const fixture = TestBed.createComponent(AdSlotComponent);
    await fixture.whenStable();
    expect(remove).not.toHaveBeenCalled();

    fixture.destroy();

    expect(remove).toHaveBeenCalled();
  });
});
