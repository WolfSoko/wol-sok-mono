import { TestBed } from '@angular/core/testing';
import { FakeGameModeration } from '../../testing/fake-game-moderation';
import { GameCloud } from '../storage/game-cloud';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  function configure(moderation: FakeGameModeration | null): ModerationService {
    TestBed.configureTestingModule({
      providers: [
        { provide: GameCloud, useValue: { moderation: () => moderation } },
      ],
    });
    return TestBed.inject(ModerationService);
  }

  it('bans nobody and tells nothing without the cloud', async () => {
    const service = configure(null);

    expect(service.banned()).toBe(false);
    expect(service.notices()).toEqual([]);
    await expect(service.dismiss('n1')).resolves.toBeUndefined();
  });

  it('follows the ban as the port tells it', () => {
    const moderation = new FakeGameModeration();
    const service = configure(moderation);

    moderation.banFor(Date.UTC(2026, 10, 1), 'spam');
    expect(service.banned()).toBe(true);
    expect(service.ban()?.reason).toBe('spam');

    moderation.lift();
    expect(service.banned()).toBe(false);
  });

  it('lists the notices and dismisses one', async () => {
    const moderation = new FakeGameModeration();
    const service = configure(moderation);
    moderation.notify({ id: 'n1', type: 'image-removed', at: 1 });
    moderation.notify({ id: 'n2', type: 'unbanned', at: 2 });

    await service.dismiss('n1');

    expect(moderation.dismissed).toEqual(['n1']);
    expect(service.notices().map((notice) => notice.id)).toEqual(['n2']);
  });
});
