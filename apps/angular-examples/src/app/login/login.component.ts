import {Component, OnDestroy, OnInit} from '@angular/core';
import {UntilDestroy, untilDestroyed} from '@ngneat/until-destroy';
import {AuthenticationService, AuthQuery, Profile} from '../core';

@UntilDestroy()
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  user: Profile;

  constructor(private authQuery: AuthQuery, private authService: AuthenticationService) {
  }

  ngOnInit(): void {
    this.authQuery.profile$.pipe(untilDestroyed(this)).subscribe(user => this.user = user);
  }

  async login(): Promise<unknown> {
    return await this.authService.signIn();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }

  ngOnDestroy(): void {
  }

}
