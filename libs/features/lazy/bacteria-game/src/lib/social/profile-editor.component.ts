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

  protected readonly changed = signal(false);
  protected readonly busy = signal(false);
  protected readonly note = signal<TranslationKey | null>(null);
  /**
   * The profile as edited - the saved one until the player changes it. One
   * that arrives later does not undo what the player typed.
   */
  protected readonly draft = linkedSignal<Profile | null, Profile | null>({
    source: this.social.profile,
    computation: (saved, previous) =>
      previous !== undefined && untracked(this.changed)
        ? previous.value
        : saved,
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
    if (draft === null) {
      return;
    }
    const profile: Profile = {
      ...draft,
      name: cleanName(draft.name) ?? this.social.profile()?.name ?? 'Player',
      motto: cleanMotto(draft.motto),
    };
    this.busy.set(true);
    this.note.set(null);
    try {
      await this.social.saveProfile(profile);
      this.changed.set(false);
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
      this.changed.set(true);
      this.note.set(null);
    }
  }
}
