import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Account } from '../../shared/account';
import { AccountPort } from '../ports/account.port';

@Injectable()
export class AccountAdapterMock extends AccountPort {
  public readonly accountSubject = new BehaviorSubject<Account | null>(null);
  public readonly account$: Observable<Account | null> = this.accountSubject;

  public async signInWithGoogle(): Promise<void> {
    this.accountSubject.next({
      uid: this.accountSubject.value?.uid ?? 'mock-user',
      isAnonymous: false,
      displayName: 'Ada Lovelace',
      photoUrl: null,
    });
  }

  public async signOut(): Promise<void> {
    this.accountSubject.next(null);
  }
}
