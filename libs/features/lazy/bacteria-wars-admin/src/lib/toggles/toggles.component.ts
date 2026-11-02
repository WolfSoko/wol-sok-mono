import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
  type FeatureToggle,
  type FeatureToggles,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import {
  AdminI18n,
  type AdminTextKey,
  AdminTextPipe,
} from '../i18n/admin-i18n.service';
import { AdminActionsService } from '../moderation/admin-actions.service';
import { AdminTogglesService, type ToggleState } from './admin-toggles.service';

/**
 * The feature toggles (ADR 0012): what Remote Config holds, each toggle's
 * default, and switches that publish the changes through `toggles.set` -
 * with a reason and a fresh sign-in, like every command that changes what
 * players get. Players' devices fetch at most once an hour.
 */
@Component({
  selector: 'feat-lazy-bac-admin-toggles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTextPipe, MatButtonModule, MatSlideToggleModule],
  template: `
    <p class="hint">{{ 'toggles.hint' | adminT }}</p>
    @if (failed()) {
      <p class="error" role="alert">{{ 'toggles.failed' | adminT }}</p>
    }
    @if (state(); as state) {
      @if (!state.available) {
        <p class="error">{{ 'toggles.unavailable' | adminT }}</p>
      }
      <ul class="toggles">
        @for (key of keys; track key) {
          <li>
            <mat-slide-toggle
              [checked]="draft()[key]"
              [disabled]="!state.available || busy()"
              (change)="setDraft(key, $event.checked)"
            >
              {{ nameKey(key) | adminT }}
            </mat-slide-toggle>
            <small>
              @if (key in state.set) {
                {{ 'toggles.fromRemoteConfig' | adminT }}
              } @else {
                {{
                  'toggles.default' | adminT: { value: onOff(defaults[key]) }
                }}
              }
              @if (draft()[key] !== state.values[key]) {
                · <strong>{{ 'toggles.changed' | adminT }}</strong>
              }
            </small>
          </li>
        }
      </ul>
      <div class="buttons">
        <button
          mat-flat-button
          type="button"
          [disabled]="changes().length === 0 || busy()"
          (click)="publish()"
        >
          {{ 'toggles.publish' | adminT: { count: changes().length } }}
        </button>
        <button
          mat-button
          type="button"
          [disabled]="changes().length === 0 || busy()"
          (click)="draft.set(state.values)"
        >
          {{ 'toggles.discard' | adminT }}
        </button>
        <button
          mat-button
          type="button"
          [disabled]="busy()"
          (click)="load(true)"
        >
          {{ 'toggles.reload' | adminT }}
        </button>
      </div>
      @if (published(); as published) {
        <p>{{ 'toggles.published' | adminT: { toggles: published } }}</p>
      }
    } @else if (!failed()) {
      <p>{{ 'list.loading' | adminT }}</p>
    }
  `,
  styles: `
    .hint {
      opacity: 0.7;
    }
    .error {
      color: #ff8a80;
    }
    .toggles {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .toggles li {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class TogglesComponent {
  private readonly toggles = inject(AdminTogglesService);
  private readonly actions = inject(AdminActionsService);
  private readonly i18n = inject(AdminI18n);

  protected readonly keys = FEATURE_TOGGLE_KEYS;
  protected readonly defaults = FEATURE_TOGGLES;
  protected readonly state = signal<ToggleState | null>(null);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  /** While a read or a publish runs, the draft and its buttons are locked. */
  protected readonly busy = computed(() => this.saving() || this.loading());
  /** The switches as the owner set them, before publishing. */
  protected readonly draft = signal<FeatureToggles>({ ...FEATURE_TOGGLES });
  /** The names of the toggles last published, for the note under them. */
  protected readonly published = signal<string | null>(null);
  /** The toggles the draft changes, against what Remote Config holds. */
  protected readonly changes = computed((): FeatureToggle[] => {
    const values = this.state()?.values;
    return values === undefined
      ? []
      : this.keys.filter((key) => this.draft()[key] !== values[key]);
  });

  public constructor() {
    void this.load(true);
  }

  protected nameKey(key: FeatureToggle): AdminTextKey {
    return `toggles.name.${key}`;
  }

  protected onOff(on: boolean): string {
    return this.i18n.t(on ? 'toggles.on' : 'toggles.off');
  }

  protected setDraft(key: FeatureToggle, on: boolean): void {
    this.draft.update((draft) => ({ ...draft, [key]: on }));
  }

  /** Reads the toggles and resets the draft to them; one read at a time. */
  protected async load(fresh: boolean): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);
    try {
      const state = await this.toggles.read(fresh);
      this.state.set(state);
      this.draft.set(state.values);
    } catch (error) {
      console.error('Could not read the toggles', error);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Publishes the changed toggles, then reads them back. */
  protected async publish(): Promise<void> {
    const changed = this.changes();
    if (changed.length === 0) {
      return;
    }
    const values = Object.fromEntries(
      changed.map((key) => [key, this.draft()[key]])
    ) as Partial<FeatureToggles>;
    this.saving.set(true);
    try {
      const result = await this.actions.run({
        type: 'toggles.set',
        subject: changed
          .map((key) => this.i18n.t(this.nameKey(key)))
          .join(', '),
        target: null,
        args: { values },
      });
      if (result?.ok) {
        this.published.set(
          changed
            .map(
              (key) =>
                `${this.i18n.t(this.nameKey(key))}: ${this.onOff(values[key] === true)}`
            )
            .join(', ')
        );
        await this.load(true);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
