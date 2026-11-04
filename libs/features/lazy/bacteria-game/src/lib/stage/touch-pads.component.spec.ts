import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ColonyStats } from '../colony-stats';
import { TouchPadsComponent } from './touch-pads.component';

function colony(id: number, weapon: ColonyStats['weapon'] = null): ColonyStats {
  return {
    id,
    name: `Colony ${id}`,
    isBot: false,
    css: 'rgba(255,100,20,255)',
    bacterias: 420,
    captured: 0,
    lost: 0,
    energy: 92,
    boosting: false,
    boostReady: true,
    boostCooldown: 0,
    boostCharge: 1,
    boostKey: id === 0 ? 'Space' : 'Enter',
    held: 0,
    pellets: 0,
    weapon,
  };
}

describe('TouchPadsComponent', () => {
  let fixture: ComponentFixture<TouchPadsComponent>;

  function create(colonies: ColonyStats[]): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TouchPadsComponent, NoopAnimationsModule],
    });
    fixture = TestBed.createComponent(TouchPadsComponent);
    fixture.componentRef.setInput('colonies', colonies);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('seats each player at their own side', () => {
    const host = create([colony(0), colony(1)]);

    const seats = Array.from(host.querySelectorAll('.seat')).map((seat) =>
      seat.getAttribute('data-seat')
    );
    expect(seats).toEqual(['0', '1']);
    expect(host.querySelectorAll('.stick')).toHaveLength(2);
    expect(host.classList).not.toContain('solo');
  });

  it('seats a single player alone', () => {
    const host = create([colony(0)]);

    expect(host.classList).toContain('solo');
  });

  it('shows the weapon pad only for a colony that carries one', () => {
    const host = create([
      colony(0),
      colony(1, {
        id: 'cryo-pulse',
        ready: true,
        active: false,
        cooldown: 0,
        charge: 1,
      }),
    ]);

    const pads = host.querySelectorAll('.seat');
    expect(pads[0].querySelector('feat-lazy-bac-game-weapon-pad')).toBeNull();
    expect(
      pads[1].querySelector('feat-lazy-bac-game-weapon-pad')
    ).not.toBeNull();
  });

  it('names the player whose boost was pressed', () => {
    create([colony(0), colony(3)]);
    const boost = jest.fn();
    fixture.componentInstance.boost.subscribe(boost);

    fixture.nativeElement
      .querySelectorAll('feat-lazy-bac-game-boost-pad button')[1]
      .click();

    expect(boost).toHaveBeenCalledWith(3);
  });

  it('takes the seats out of reach under a menu screen', () => {
    create([colony(0)]);
    fixture.componentRef.setInput('outOfReach', true);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.stick')?.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.seat')?.hasAttribute('inert')).toBe(true);
  });
});
