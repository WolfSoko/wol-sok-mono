import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { GameAccount } from '../storage/game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import { defaultProfile } from '@wolsok/feat-shared-bacteria-engine';
import { SocialNoticesComponent } from './social-notices.component';

describe('SocialNoticesComponent', () => {
  let social: FakeGameSocial;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    social = new FakeGameSocial();
    await social.saveProfile('bob', { ...defaultProfile('bob'), name: 'Bob' });
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        provideFakeGameCloud({ social, presence: new FakeGamePresence() }),
      ],
    });
  });

  async function render(): Promise<string> {
    const fixture = TestBed.createComponent(SocialNoticesComponent);
    fixture.componentRef.setInput('invite', { token: 't', from: 'bob' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return host.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('offers to add the friend who sent the invitation', async () => {
    const text = await render();

    expect(text).toContain('Add Bob as a friend?');
    expect(text).toContain('Add friend');
  });

  it('speaks German', async () => {
    TestBed.inject(I18nService).setLanguage('de');
    const text = await render();

    expect(text).toContain('Bob als Freund hinzufügen?');
  });
});
