import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ColonyStats } from '../colony-stats';
import { BoostPadComponent } from './boost-pad.component';

const orange: ColonyStats = {
  id: 0,
  name: 'Orange',
  isBot: false,
  css: 'rgba(255,100,20,255)',
  bacterias: 420,
  captured: 3,
  lost: 1,
  energy: 92,
  share: 55,
  boosting: false,
  boostReady: true,
  boostCooldown: 0,
  boostCharge: 1,
  boostKey: 'Space',
};

describe('BoostPadComponent', () => {
  let fixture: ComponentFixture<BoostPadComponent>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function progress(selector: string): string | null {
    return fixture.nativeElement
      .querySelector(selector)
      .getAttribute('aria-valuenow');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoostPadComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(BoostPadComponent);
    fixture.componentRef.setInput('colony', orange);
    await fixture.whenStable();
  });

  /** A press of the button, as a finger or a mouse sends it. */
  function press(): void {
    button().dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0 })
    );
  }

  it('fires the boost of its colony on the press', () => {
    const fired = jest.fn();
    fixture.componentInstance.boost.subscribe(fired);

    press();

    expect(fired).toHaveBeenCalledTimes(1);
    expect(button().getAttribute('aria-label')).toBe('Boost Orange');
  });

  it('fires from the keyboard, which only sends a click', () => {
    const fired = jest.fn();
    fixture.componentInstance.boost.subscribe(fired);

    // Enter or Space on a focused button: a click with detail 0.
    button().click();

    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('shows the recharge and keeps the button down until it is full', async () => {
    fixture.componentRef.setInput('colony', {
      ...orange,
      boostReady: false,
      boostCooldown: 3,
      boostCharge: 0.25,
    });
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('3s');
    expect(progress('.charge')).toBe('25');
  });

  it('shows the colony share', () => {
    expect(progress('.share')).toBe('55');
  });

  it('is down while no match is on', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
  });
});
