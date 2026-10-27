import { TestBed } from '@angular/core/testing';
import { ColonyStats } from './colony-stats';
import { HudBarComponent } from './hud-bar.component';
import { I18nService } from './i18n/i18n.service';

function colony(overrides: Partial<ColonyStats>): ColonyStats {
  return {
    id: 0,
    name: 'You',
    isBot: false,
    css: 'rgb(255 100 20)',
    bacterias: 420,
    captured: 0,
    lost: 0,
    energy: 100,
    share: 50,
    boosting: false,
    boostReady: true,
    boostCooldown: 0,
    boostCharge: 1,
    boostKey: 'Space',
    held: 0,
    pellets: 0,
    weapon: null,
    ...overrides,
  };
}

function render(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(HudBarComponent);
  const values: Record<string, unknown> = {
    levelName: { key: 'training.title' },
    clockLabel: 'Game time',
    clockText: '1:05',
    colonies: [
      colony({}),
      colony({ id: 1, name: 'Ada', bacterias: 380, boosting: true }),
    ],
    neutralCss: 'rgb(150 150 150)',
    sound: true,
    fullscreen: false,
    ...inputs,
  };
  for (const [name, value] of Object.entries(values)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  return { fixture, host, button };
}

describe('HudBarComponent', () => {
  it("shows the clock and each colony's count, the boosting one pulsing", () => {
    const { host } = render({ timeRunningOut: true, neutral: 12 });

    expect(host.querySelector('.game-time')?.textContent).toContain('1:05');
    expect(host.querySelector('.game-time.running-out')).not.toBeNull();
    const counts = [...host.querySelectorAll('.hud-colony .colony-count')];
    expect(counts.map((count) => count.textContent)).toEqual([
      '420',
      '380',
      '12',
    ]);
    expect(host.querySelectorAll('.hud-colony.boosting')).toHaveLength(1);
  });

  it("shows each colony's energy and, where asked for, the frame rate", () => {
    const { fixture, host } = render({ fps: 58 });

    const energies = [...host.querySelectorAll('.colony-energy')];
    expect(energies.map((energy) => energy.textContent?.trim())).toEqual([
      '⚡100% energy',
      '⚡100% energy',
    ]);
    expect(host.querySelector('.hud-fps')?.textContent).toContain('58 FPS');

    fixture.componentRef.setInput('fps', 0);
    fixture.detectChanges();
    expect(host.querySelector('.hud-fps')?.textContent).toContain('0 FPS');

    fixture.componentRef.setInput('fps', null);
    fixture.detectChanges();

    expect(host.querySelector('.hud-fps')).toBeNull();
  });

  it('names the colonies in the active language, a player as they are', () => {
    const { fixture, host } = render();
    const names = () =>
      [...host.querySelectorAll('.colony-name')].map((name) =>
        name.textContent?.trim()
      );
    expect(names()).toEqual(['You', 'Ada']);

    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();

    expect(names()).toEqual(['Du', 'Ada']);
  });

  it("counts towards a level's goal", () => {
    const { host } = render({
      colonies: [colony({ held: 7 })],
      goal: {
        icon: 'flag',
        label: 'stage.hud.secondsHeld',
        target: 30,
        of: 'held',
      },
    });

    expect(host.querySelector('.colony-held')?.textContent).toContain('7/30');
  });

  it('reports its buttons: sound, pause and fullscreen', () => {
    const { fixture, button } = render({ showPause: true });
    const sound = jest.fn();
    const pause = jest.fn();
    const fullscreen = jest.fn();
    fixture.componentInstance.soundChange.subscribe(sound);
    fixture.componentInstance.pause.subscribe(pause);
    fixture.componentInstance.fullscreenChange.subscribe(fullscreen);

    button('Mute')?.click();
    button('Pause')?.click();
    button('Fullscreen')?.click();

    expect(sound).toHaveBeenCalledWith(false);
    expect(pause).toHaveBeenCalled();
    expect(fullscreen).toHaveBeenCalledWith(true);
  });

  it('offers giving up instead of a pause in a ranked match', () => {
    const { fixture, host, button } = render({ showGiveUp: true });
    const giveUp = jest.fn();
    fixture.componentInstance.giveUp.subscribe(giveUp);

    expect(button('Pause')).toBeNull();
    host
      .querySelector<HTMLButtonElement>('.hud-actions button:nth-child(2)')
      ?.click();

    expect(giveUp).toHaveBeenCalled();
  });
});
