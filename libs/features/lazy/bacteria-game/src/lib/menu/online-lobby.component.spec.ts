import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { I18nService } from '../i18n/i18n.service';
import { IDLE_LOBBY, OnlineLobby } from '../net/online-match.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { OnlineLobbyComponent } from './online-lobby.component';

describe('OnlineLobbyComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            social: () => null,
            presence: () => null,
            rooms: () => null,
          },
        },
      ],
    });
  });

  function render(
    lobby: Partial<OnlineLobby>,
    colonyNames: readonly [string, string] | null = null
  ): HTMLElement {
    const fixture = TestBed.createComponent(OnlineLobbyComponent);
    fixture.componentRef.setInput('lobby', { ...IDLE_LOBBY, ...lobby });
    fixture.componentRef.setInput('colonyNames', colonyNames);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const text = (host: HTMLElement) =>
    host.textContent?.replace(/\s+/g, ' ').trim();

  it('offers to open a match or join one with a code', () => {
    const host = render({});

    expect(text(host)).toContain('Play with a code');
    expect(text(host)).toContain('Open a match');
  });

  it('names the colony the player steers, and the notice', () => {
    const host = render(
      {
        phase: 'connected',
        role: 'guest',
        notice: { key: 'online.notices.opponentLeft' },
      },
      ['Orange', 'Blue']
    );

    expect(text(host)).toContain('Connected - you play Blue.');
    expect(text(host)).toContain('Your opponent left.');
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const host = render(
      {
        phase: 'connected',
        role: 'guest',
        notice: { key: 'online.notices.lost' },
      },
      ['Orange', 'Blue']
    );

    expect(text(host)).toContain('Verbunden – du spielst Blau.');
    expect(text(host)).toContain(
      'Die Verbindung zu deinem Gegner ist abgebrochen.'
    );
    expect(text(host)).toContain('Verlassen');
  });
});
