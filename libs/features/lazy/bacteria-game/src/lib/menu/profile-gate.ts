import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith, switchMap, timer } from 'rxjs';
import { EVOLUTION_WAIT_MS, EvolutionService } from '../evolution.service';
import { ProgressService } from '../progress.service';
import { GameSettingsService } from '../settings.service';
import { SocialService } from '../social/social.service';
import { GameAccount } from '../storage/game-account';

/**
 * How long the menu waits for the player profile at most, in ms, from the
 * start and again from every player switch - as long as a match waits for
 * the evolution.
 */
export const PROFILE_WAIT_MS = EVOLUTION_WAIT_MS;

/** Which parts of the player profile have answered, and which apply. */
export interface ProfileSources {
  /** The settings: colours, language, sound. */
  settings: boolean;
  /** XP, campaign, medals and achievements. */
  progress: boolean;
  /** DNA and what it bought. */
  evolution: boolean;
  /** True where the game has a cloud account to sign in to. */
  cloud: boolean;
  /** The cloud account is known (the account chip). */
  account: boolean;
  /** True where the cloud keeps a social profile. */
  social: boolean;
  /** The stored social profile was read (avatar and name). */
  socialLoaded: boolean;
}

/** True once every part of the player profile that applies has answered. */
export function profileKnown(sources: ProfileSources): boolean {
  const local = sources.settings && sources.progress && sources.evolution;
  if (!local || !sources.cloud) {
    return local;
  }
  return sources.account && (!sources.social || sources.socialLoaded);
}

/**
 * Whether the menu screens may show (#3241): once the player profile is
 * known, so they appear as they stay instead of jumping from defaults to
 * what is stored. A source that keeps silent holds them back for
 * {@link PROFILE_WAIT_MS} at most, from the start and again on every
 * player switch.
 */
@Injectable({ providedIn: 'root' })
export class ProfileGate {
  private readonly account = inject(GameAccount);
  private readonly settings = inject(GameSettingsService);
  private readonly progress = inject(ProgressService);
  private readonly evolution = inject(EvolutionService);
  private readonly social = inject(SocialService);

  private readonly waitedOut = signal(false);

  private readonly known = computed(() =>
    profileKnown({
      settings: this.settings.loaded(),
      progress: this.progress.loaded(),
      evolution: this.evolution.loaded(),
      cloud: this.account.cloud,
      account: this.account.profile() !== null,
      social: this.social.available,
      socialLoaded: this.social.profileLoaded(),
    })
  );

  /** True while the menu screens may show. */
  public readonly ready = computed(() => this.known() || this.waitedOut());

  public constructor() {
    // Counted from the start too: a first guest whose sign-in fails sends
    // no switch at all, and the menu must not wait for one forever.
    this.account.players
      .pipe(
        startWith(null),
        switchMap(() => {
          this.waitedOut.set(false);
          return timer(PROFILE_WAIT_MS);
        }),
        takeUntilDestroyed()
      )
      .subscribe(() => this.waitedOut.set(true));
  }
}
