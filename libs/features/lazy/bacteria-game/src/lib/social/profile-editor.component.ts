import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslationKey } from '../i18n/dictionaries';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ModerationService } from '../moderation/moderation.service';
import { GameAccount } from '../storage/game-account';
import { AvatarComponent } from './avatar.component';
import {
  Avatar,
  AVATAR_COUNT,
  cleanMotto,
  cleanName,
  isGooglePhoto,
  MOTTO_MAX,
  NAME_MAX,
  Profile,
} from './profile';
import { shrinkImage } from './shrink-image';
import { SocialService } from './social.service';

/**
 * What other players see of the player - their name, picture and motto -
 * whether friends see them online, and what the public sees of them: the
 * name on the leaderboards, their entries, their matches in the gallery
 * (ADR 0011, 0012). Edited and saved in one go.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile-editor',
  imports: [
    AvatarComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEditorComponent {
  protected readonly social = inject(SocialService);
  protected readonly moderation = inject(ModerationService);
  private readonly account = inject(GameAccount);

  protected readonly nameMax = NAME_MAX;
  protected readonly mottoMax = MOTTO_MAX;
  protected readonly presets: readonly Avatar[] = Array.from(
    { length: AVATAR_COUNT },
    (_, id) => ({ kind: 'preset', id })
  );
  /** The Google photo, offered once the player signed in with Google. */
  protected readonly photo = computed((): Avatar | null => {
    const url = this.account.profile()?.photoUrl;
    return url === undefined || !isGooglePhoto(url)
      ? null
      : { kind: 'photo', url };
  });

  /** The fields the player changed since the last save. */
  private readonly touched = signal<ReadonlySet<keyof Profile>>(new Set());
  protected readonly changed = computed(() => this.touched().size > 0);
  protected readonly busy = signal(false);
  protected readonly note = signal<TranslationKey | null>(null);
  /**
   * False until the stored profile is read: the switches and the save wait
   * for it, so its flags are never saved as the defaults shown meanwhile.
   */
  /**
   * True once the stored profile was read and no ban holds - under one the
   * rules refuse every save (ADR 0012), so the editor stays shut.
   */
  protected readonly loaded = computed(
    () => this.social.profileLoaded() && !this.moderation.banned()
  );
  /**
   * The profile as edited - the saved one, with the fields the player
   * changed. One that arrives later does not undo what the player typed.
   */
  protected readonly draft = linkedSignal<Profile | null, Profile | null>({
    source: this.social.profile,
    computation: (saved, previous) =>
      saved === null || previous === undefined || previous.value === null
        ? saved
        : { ...saved, ...pick(previous.value, untracked(this.touched)) },
  });

  protected setName(event: Event): void {
    this.edit({ name: (event.target as HTMLInputElement).value });
  }

  protected setMotto(event: Event): void {
    this.edit({ motto: (event.target as HTMLInputElement).value });
  }

  protected pick(avatar: Avatar): void {
    this.edit({ avatar });
  }

  protected setShareStatus(shareStatus: boolean): void {
    this.edit({ shareStatus });
  }

  protected setPublicName(publicName: boolean): void {
    this.edit({ publicName });
  }

  protected setBoardOptOut(boardOptOut: boolean): void {
    this.edit({ boardOptOut });
  }

  protected setGalleryOptOut(galleryOptOut: boolean): void {
    this.edit({ galleryOptOut });
  }

  protected isPicked(avatar: Avatar): boolean {
    const current = this.draft()?.avatar;
    return JSON.stringify(current) === JSON.stringify(avatar);
  }

  /** Takes an image file, scaled down to a small square. */
  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const data = await shrinkImage(file);
    if (data === null) {
      this.note.set('profile.editor.unreadable');
      return;
    }
    this.note.set(null);
    this.edit({ avatar: { kind: 'image', data } });
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (draft === null || !this.loaded()) {
      return;
    }
    const touched = this.touched();
    const changes = pick(
      {
        ...draft,
        name: cleanName(draft.name) ?? this.social.profile()?.name ?? 'Player',
        motto: cleanMotto(draft.motto),
      },
      touched
    );
    this.busy.set(true);
    this.note.set(null);
    try {
      await this.social.saveProfile(changes);
      // What the player changed meanwhile stays to be saved.
      this.touched.update(
        (now) => new Set([...now].filter((field) => !touched.has(field)))
      );
      this.note.set('profile.editor.saved');
    } catch (error) {
      console.error('Could not save the profile', error);
      this.note.set('social.failed');
    } finally {
      this.busy.set(false);
    }
  }

  private edit(change: Partial<Profile>): void {
    const draft = this.draft();
    if (draft !== null) {
      this.draft.set({ ...draft, ...change });
      this.touched.update(
        (touched) =>
          new Set([...touched, ...(Object.keys(change) as (keyof Profile)[])])
      );
      this.note.set(null);
    }
  }
}

/** The fields of a profile named. */
function pick(
  profile: Profile,
  fields: ReadonlySet<keyof Profile>
): Partial<Profile> {
  return Object.fromEntries(
    [...fields].map((field) => [field, profile[field]])
  ) as Partial<Profile>;
}
