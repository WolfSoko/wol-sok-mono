import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AccountAdapterMock } from './adapter/account-adapter-mock.service';
import { AppComponent } from './app.component';
import { AccountPort } from './ports/account.port';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AccountPort, useClass: AccountAdapterMock },
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

  it('should register xTwitter icons to MatIconRegistry', async () => {
    const addSvgIconSpy = vi.spyOn(
      TestBed.inject(MatIconRegistry),
      'addSvgIconLiteralInNamespace'
    );
    TestBed.createComponent(AppComponent);

    expect(addSvgIconSpy).toHaveBeenCalledWith(
      'fa',
      'xTwitter',
      expect.objectContaining({
        changingThisBreaksApplicationSecurity: expect.stringContaining('<svg'),
      })
    );
  });
});
