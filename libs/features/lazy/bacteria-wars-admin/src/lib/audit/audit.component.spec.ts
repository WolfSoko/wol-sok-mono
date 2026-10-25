import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AdminRecordsService,
  type AuditFilter,
} from '../moderation/admin-records.service';
import { AuditComponent } from './audit.component';

describe('AuditComponent', () => {
  it('shows the audit newest first, with what each command did', async () => {
    const audit = jest.fn(async (_filter: AuditFilter) => ({
      rows: [
        {
          id: 'c1',
          at: Date.UTC(2026, 9, 25),
          by: 'own',
          type: 'player.ban',
          uid: 'ada',
          entry: null,
          reason: 'aimbot',
          ok: true,
          error: null,
          before: null,
          after: { until: null },
        },
        {
          id: 'c2',
          at: null,
          by: 'system',
          type: 'board.hideEntry',
          uid: null,
          entry: { boardId: 'xp', entryId: 'x1' },
          reason: '',
          ok: false,
          error: 'not-on-board',
          before: null,
          after: null,
        },
      ],
      next: null,
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdminRecordsService, useValue: { audit } },
      ],
    });
    const fixture = TestBed.createComponent(AuditComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(audit).toHaveBeenCalledWith({ by: 'all' }, null);
    expect(text).toContain('Ban');
    expect(text).toContain('aimbot');
    expect(text).toContain('Done');
    expect(text).toContain('Before and after');
    expect(text).toContain('not-on-board');
    expect(text).toContain('xp / x1');
    expect(text).toContain('system');
  });
});
