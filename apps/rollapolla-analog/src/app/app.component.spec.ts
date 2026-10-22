import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AccountAdapterMock } from './adapter/account-adapter-mock.service';
import { AdminAdapterMock } from './adapter/admin-adapter-mock.service';
import { AppComponent } from './app.component';
import { AccountPort } from './ports/account.port';
import { AdminPort } from './ports/admin.port';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AccountPort, useClass: AccountAdapterMock },
        { provide: AdminPort, useClass: AdminAdapterMock },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have as title "Polls for everyone | RollaPolla.com"', () => {
    TestBed.createComponent(AppComponent);
    expect(TestBed.inject(Title).getTitle()).toEqual(
      'Polls for everyone | RollaPolla.com'
    );
  });
});
