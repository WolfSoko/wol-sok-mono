import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GameAccount } from '../storage/game-account';
import { DeviceStorage } from '../storage/game-storage';
import {
  GUEST_NOTICE_KEY,
  GuestVisits,
  noticeDue,
  parseGuestVisits,
  withVisit,
} from './guest-visits';

/**
 * What a guest hears about keeping their progress: the main menu's notice
 * that an unused guest account is deleted, from the third day the game was
 * opened on this device (or at once after a pause of more than a month),
 * put away for two weeks by "Later" - and the result screen's offer to sign
 * in after a success, once per device. Counts the days the game was opened
 * on this device, with the cloud only: without it nobody plays as a guest.
 */
@Injectable({ providedIn: 'root' })
export class GuestNotice {
  private readonly account = inject(GameAccount);
  private readonly storage = inject(DeviceStorage);

  /** What the device stored - undefined until it has answered. */
  private readonly visits = signal<GuestVisits | undefined>(undefined);
  /** True when this visit follows a pause of more than a month. */
  public readonly cameBack = signal(false);

  /** True while a guest plays, in the cloud. */
  public readonly guest = computed(
    () => this.account.cloud && this.account.profile()?.guest === true
  );

  /** True while the main menu shows the guest's notice. */
  public readonly visible = computed(() => {
    const visits = this.visits();
    return (
      this.guest() &&
      visits !== undefined &&
      noticeDue(visits, this.cameBack(), Date.now())
    );
  });

  /** True while a guest's success may still bring the offer to sign in. */
  public readonly successHintDue = computed(
    () => this.guest() && this.visits()?.successHintShown === false
  );

  public constructor() {
    if (!this.account.cloud) return;
    let counted = false;
    this.storage
      .watch(GUEST_NOTICE_KEY)
      .pipe(map(parseGuestVisits), takeUntilDestroyed())
      .subscribe((stored) => {
        if (counted) {
          // Another tab changed it.
          this.visits.set(stored);
          return;
        }
        counted = true;
        const { visits, cameBack } = withVisit(stored, Date.now());
        this.cameBack.set(cameBack);
        if (visits === stored) {
          this.visits.set(stored);
        } else {
          this.save(visits);
        }
      });
  }

  /** Puts the notice away for two weeks on this device. */
  public dismiss(): void {
    this.change({ dismissedAt: Date.now() });
  }

  /** Notes that the result screen offered the sign-in. */
  public markSuccessHintShown(): void {
    this.change({ successHintShown: true });
  }

  private change(part: Partial<GuestVisits>): void {
    const visits = this.visits();
    if (visits !== undefined) {
      this.save({ ...visits, ...part });
    }
  }

  /**
   * Keeps the visits here as well, since the local storage tells only
   * other tabs of a write.
   */
  private save(visits: GuestVisits): void {
    this.visits.set(visits);
    this.storage.write(GUEST_NOTICE_KEY, visits);
  }
}
