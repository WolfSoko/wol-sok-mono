import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ColonyStats } from '../colony-stats';
import { SeatComponent } from './seat.component';

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
  boostCooldown: 0,
  boostCharge: 1,
  boostKey: 'Space',
};

describe('SeatComponent', () => {
  let fixture: ComponentFixture<SeatComponent>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(SeatComponent);
    fixture.componentRef.setInput('colony', orange);
    fixture.componentRef.setInput('running', true);
    await fixture.whenStable();
  });

  it('fires the boost of its colony', () => {
    const fired = jest.fn();
    fixture.componentInstance.boost.subscribe(fired);

    button().click();

    expect(fired).toHaveBeenCalledTimes(1);
    expect(button().getAttribute('aria-label')).toBe('Boost Orange');
  });

  it('shows the recharge and keeps the button down until it is full', async () => {
    fixture.componentRef.setInput('colony', {
      ...orange,
      boostCooldown: 3,
      boostCharge: 0.25,
    });
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('3s');
    // jsdom drops a conic gradient from the style, so the ring is read here.
    expect(fixture.componentInstance['chargeRing']()).toContain('25%');
  });

  it('is down while no match is on', async () => {
    fixture.componentRef.setInput('running', false);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
  });

  it('turns towards the far player', async () => {
    fixture.componentRef.setInput('flipped', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.classList.contains('flipped')).toBe(true);
  });
});
