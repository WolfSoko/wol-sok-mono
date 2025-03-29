import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule, AppComponent],
      providers: [provideExperimentalZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have as title "Polls for everyone | RollaPolla.com" ', () => {
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
