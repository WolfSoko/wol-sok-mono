import { TestBed } from '@angular/core/testing';
import { BALANCE_VERSION } from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { LevelStatsRecord } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { BalanceComponent } from './balance.component';

const STATS: LevelStatsRecord = {
  id: 'l1_hard_b6_l1',
  level: 'l1',
  difficulty: 'hard',
  balanceVersion: 6,
  ladder: 1,
  attempts: 10,
  wins: 6,
  losses: 3,
  draws: 1,
  evolved: 4,
  plainWins: 3,
  evolvedWins: 3,
  durations: { lt2m: 5, lt5m: 5 },
  weapons: { laser: 3, spikes: 1 },
  rerun: 2,
  medals: { gold: 1, bronze: 1 },
};

function render() {
  const levelStats = jest.fn(async (_version: number) => ({
    rows: [
      STATS,
      {
        ...STATS,
        id: 'l2',
        level: 'l2',
        ladder: 0,
        attempts: 0,
        wins: 0,
        // Buckets and tiers the view does not know follow the known ones.
        durations: { ge10m: 1 },
        medals: { gold: 1, bronze: 1, diamond: 2 },
      },
    ],
    next: null,
  }));
  TestBed.configureTestingModule({
    providers: [{ provide: AdminRecordsService, useValue: { levelStats } }],
  });
  const fixture = TestBed.createComponent(BalanceComponent);
  return { fixture, levelStats };
}

describe('BalanceComponent', () => {
  it('shows the current balance version, level by level', async () => {
    const { fixture, levelStats } = render();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(levelStats).toHaveBeenCalledWith(BALANCE_VERSION, null);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain(`Balance version ${BALANCE_VERSION}`);
    expect(text).toContain('l1');
    expect(text).toContain('hard · ladder 1');
    expect(text).toContain('6 won · 3 lost · 1 drawn');
    // 6 of 10 won; 3 of the 6 plain ones; 4 of 10 evolved, 3 of them won.
    expect(text).toContain('60%');
    expect(text).toContain('without evolving: 50%');
    expect(text).toContain('40%');
    expect(text).toContain('wins when evolved: 75%');
    expect(text).toContain('<2 min 50% · <5 min 50%');
    expect(text).toContain('laser 75% · spikes 25%');
    expect(text).toContain('Gold 1 · Bronze 1 · diamond 2');
    expect(text).toContain('≥10 min');
    expect(text).toContain('computer off the curve');
    // No division by zero for a level nobody played yet.
    expect(text).toContain('–');
  });
});
