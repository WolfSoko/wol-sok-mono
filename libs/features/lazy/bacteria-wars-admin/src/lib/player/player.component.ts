import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AvatarComponent,
  type BanReason,
  isUid,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AuditTableComponent } from '../audit/audit-table.component';
import {
  AdminI18n,
  type AdminTextKey,
  AdminTextPipe,
} from '../i18n/admin-i18n.service';
import {
  AdminActionsService,
  type ModerationAction,
} from '../moderation/admin-actions.service';
import {
  type AuditRecord,
  banHolds,
  MODERATION_COUNTS,
  type ModerationCount,
} from '../moderation/admin-records';
import {
  AdminRecordsService,
  type PlayerRecord,
} from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

type PlayerEntry = PlayerRecord['entries'][number];

/**
 * One player (ADR 0012): profile, board entries, ban, the moderation so
 * far and the audit about them - and every command on them. The records
 * follow live, so a command's effect shows when the function is done.
 */
@Component({
  selector: 'feat-lazy-bac-admin-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    AuditTableComponent,
    AvatarComponent,
    ListFooterComponent,
    MatButtonModule,
    MatCardModule,
    RouterLink,
  ],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss',
})
export class PlayerComponent {
  private readonly records = inject(AdminRecordsService);
  private readonly actions = inject(AdminActionsService);
  protected readonly i18n = inject(AdminI18n);

  protected readonly uid = signal('');
  protected readonly player = signal<PlayerRecord | null>(null);
  protected readonly audit = new PagedList<AuditRecord>();
  protected readonly counts = MODERATION_COUNTS;
  /** The name the dialogs and the title show. */
  protected readonly subject = computed(
    () => this.player()?.profile?.name ?? this.uid()
  );
  protected readonly banned = computed(() => {
    const ban = this.player()?.ban ?? null;
    return ban !== null && banHolds(ban, Date.now());
  });

  public constructor() {
    let stop: (() => void) | null = null;
    const route = inject(ActivatedRoute);
    const subscription = route.paramMap.subscribe((params) => {
      stop?.();
      stop = null;
      const uid = params.get('uid') ?? '';
      this.uid.set(uid);
      this.player.set(null);
      if (!isUid(uid)) {
        return;
      }
      stop = this.records.watchPlayer(uid, (player) => this.player.set(player));
      void this.audit.load((after) =>
        this.records.audit({ by: 'uid', uid }, after)
      );
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      stop?.();
    });
  }

  protected countKey(count: ModerationCount): AdminTextKey {
    return `player.count.${count}`;
  }

  protected banReasonKey(reason: BanReason): AdminTextKey {
    return `banReason.${reason}`;
  }

  protected hiddenByOwner(entry: PlayerEntry): boolean {
    return entry.record?.hiddenBy.includes('admin') ?? false;
  }

  protected resetProfile(): Promise<void> {
    return this.act({ type: 'profile.reset' });
  }

  protected removeImage(): Promise<void> {
    return this.act({ type: 'profile.removeImage' });
  }

  protected hidePlayer(): Promise<void> {
    return this.act({ type: 'board.hidePlayer', bar: true });
  }

  protected restorePlayer(): Promise<void> {
    return this.act({ type: 'board.restore' });
  }

  protected ban(): Promise<void> {
    return this.act({ type: 'player.ban', ban: true });
  }

  protected unban(): Promise<void> {
    return this.act({ type: 'player.unban' });
  }

  protected hideEntry(entry: PlayerEntry): Promise<void> {
    return this.act({
      type: 'board.hideEntry',
      bar: true,
      target: { boardId: entry.boardId, entryId: entry.entryId },
    });
  }

  protected restoreEntry(entry: PlayerEntry): Promise<void> {
    return this.act({
      type: 'board.restore',
      target: { boardId: entry.boardId, entryId: entry.entryId },
    });
  }

  /** Runs a command on this player - or an entry of theirs - then reloads the audit. */
  private async act(
    action: Omit<ModerationAction, 'subject' | 'target'> & {
      target?: ModerationAction['target'];
    }
  ): Promise<void> {
    const result = await this.actions.run({
      subject: this.subject(),
      target: { uid: this.uid() },
      ...action,
    });
    if (result !== null) {
      await this.audit.reload();
    }
  }
}
