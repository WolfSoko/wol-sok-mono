import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvatarComponent, isUid } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminI18n, AdminTextPipe } from '../i18n/admin-i18n.service';
import { AdminActionsService } from '../moderation/admin-actions.service';
import {
  AdminRecordsService,
  type ProfileFilter,
  type ProfileRow,
} from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/**
 * The profiles (ADR 0012): the newest, the uploaded pictures - which the
 * owner can remove right here - or those whose name starts with a text;
 * a uid opens that player.
 */
@Component({
  selector: 'feat-lazy-bac-admin-profiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    AvatarComponent,
    FormsModule,
    ListFooterComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    RouterLink,
  ],
  template: `
    <form class="filters" (ngSubmit)="search()">
      <mat-button-toggle-group
        [value]="mode()"
        (change)="show($event.value)"
        [hideSingleSelectionIndicator]="true"
      >
        <mat-button-toggle value="newest">
          {{ 'profiles.newest' | adminT }}
        </mat-button-toggle>
        <mat-button-toggle value="pictures">
          {{ 'profiles.pictures' | adminT }}
        </mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'profiles.search' | adminT }}</mat-label>
        <input matInput name="text" [(ngModel)]="text" />
      </mat-form-field>
      <button mat-stroked-button type="submit" [disabled]="!text.trim()">
        {{ 'profiles.find' | adminT }}
      </button>
      <button
        mat-stroked-button
        type="button"
        [disabled]="!isUid(text.trim())"
        (click)="open()"
      >
        {{ 'profiles.openUid' | adminT }}
      </button>
    </form>

    <table mat-table [dataSource]="list.rows()">
      <ng-container matColumnDef="player">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.player' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          <a class="player" [routerLink]="['../player', row.uid]">
            <feat-lazy-bac-game-avatar
              [avatar]="row.profile.avatar"
              [size]="32"
            />
            <span>
              <strong>{{ row.profile.name }}</strong>
              @if (row.profile.motto) {
                <br /><small>{{ row.profile.motto }}</small>
              }
            </span>
          </a>
        </td>
      </ng-container>
      <ng-container matColumnDef="uid">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.uid' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          <code>{{ row.uid }}</code>
        </td>
      </ng-container>
      <ng-container matColumnDef="updated">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.updated' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.updatedAt === null ? '' : i18n.dateTime(row.updatedAt) }}
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.actions' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (row.profile.avatar.kind === 'image') {
            <button mat-button type="button" (click)="removeImage(row)">
              {{ 'type.profile.removeImage' | adminT }}
            </button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <feat-lazy-bac-admin-list-footer [list]="list" />
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1rem;
    }
    table {
      width: 100%;
    }
    .player {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      color: inherit;
      text-decoration: none;
      padding-block: 0.25rem;
    }
    code {
      font-size: 0.8rem;
      word-break: break-all;
    }
  `,
})
export class ProfilesComponent {
  private readonly records = inject(AdminRecordsService);
  private readonly actions = inject(AdminActionsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(AdminI18n);

  protected readonly isUid = isUid;
  protected readonly columns = ['player', 'uid', 'updated', 'actions'];
  protected readonly list = new PagedList<ProfileRow>();
  protected readonly mode = signal<ProfileFilter['by']>('newest');
  protected text = '';

  public constructor() {
    void this.load({ by: 'newest' });
  }

  protected show(by: 'newest' | 'pictures'): void {
    void this.load({ by });
  }

  protected search(): void {
    const prefix = this.text.trim();
    if (prefix !== '') {
      void this.load({ by: 'name', prefix });
    }
  }

  protected open(): void {
    const uid = this.text.trim();
    if (isUid(uid)) {
      void this.router.navigate(['../player', uid], { relativeTo: this.route });
    }
  }

  protected async removeImage(row: ProfileRow): Promise<void> {
    const result = await this.actions.run({
      type: 'profile.removeImage',
      subject: row.profile.name,
      target: { uid: row.uid },
    });
    if (result?.ok) {
      await this.list.reload();
    }
  }

  private load(filter: ProfileFilter): Promise<void> {
    this.mode.set(filter.by);
    return this.list.load((after) => this.records.profiles(filter, after));
  }
}
