import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { WeaponStats } from '../colony-stats';
import { I18nService } from '../i18n/i18n.service';
import { WeaponPadComponent } from './weapon-pad.component';

const READY: WeaponStats = {
  id: 'toxin-bomb',
  ready: true,
  active: false,
  cooldown: 0,
  charge: 1,
};

describe('WeaponPadComponent', () => {
  let fixture: ComponentFixture<WeaponPadComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaponPadComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(WeaponPadComponent);
    fixture.componentRef.setInput('weapon', READY);
    await fixture.whenStable();
    host = fixture.nativeElement;
  });

  function button(): HTMLButtonElement {
    return host.querySelector('button') as HTMLButtonElement;
  }

  it('fires the weapon on the press, and from the keyboard', () => {
    const fired = jest.fn();
    fixture.componentInstance.fire.subscribe(fired);

    button().dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0 })
    );
    button().click();

    expect(fired).toHaveBeenCalledTimes(2);
    expect(button().getAttribute('aria-label')).toBe('Fire Toxin Bomb');
    expect(button().textContent).toContain('coronavirus');
  });

  it('pulses while it is ready', () => {
    expect(host.classList).toContain('ready');
    expect(button().textContent).toContain('Fire');
  });

  it('shows the recharge and stays down until it is full', async () => {
    fixture.componentRef.setInput('weapon', {
      ...READY,
      ready: false,
      cooldown: 12,
      charge: 0.4,
    });
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(host.classList).not.toContain('ready');
    expect(button().textContent).toContain('12s');
    expect(host.querySelector('.charge')?.getAttribute('aria-valuenow')).toBe(
      '40'
    );
  });

  it('says while its effect acts', async () => {
    fixture.componentRef.setInput('weapon', {
      ...READY,
      ready: false,
      active: true,
      cooldown: 20,
      charge: 0,
    });
    await fixture.whenStable();

    expect(host.classList).toContain('active');
    expect(button().textContent).toContain('Active');
  });

  it('is down while no match is on', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
  });

  it('speaks German', async () => {
    TestBed.inject(I18nService).setLanguage('de');
    fixture.componentRef.setInput('weapon', { ...READY, id: 'cryo-pulse' });
    await fixture.whenStable();

    expect(button().getAttribute('aria-label')).toBe('Kryo-Puls abfeuern');
  });
});
