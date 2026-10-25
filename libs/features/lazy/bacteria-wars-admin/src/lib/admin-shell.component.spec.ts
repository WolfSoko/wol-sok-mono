import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AdminAccessService } from './access/admin-access.service';
import { AdminShellComponent } from './admin-shell.component';

function render(access: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AdminAccessService,
        useValue: { access: signal(access), signOut: jest.fn() },
      },
    ],
  });
  const fixture = TestBed.createComponent(AdminShellComponent);
  fixture.detectChanges();
  return fixture;
}

describe('AdminShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps search engines out, and puts the robots tag back after', () => {
    const fixture = render('signed-out');
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');

    fixture.destroy();
    expect(meta.getTag('name="robots"')).toBeNull();
  });

  it("takes down the game's loading splash", () => {
    // The test page's document, before TestBed starts.
    const doc = document;
    const splash = doc.createElement('div');
    splash.id = 'bacteria-game-splash';
    doc.body.append(splash);

    render('checking');

    expect(splash.isConnected).toBe(false);
  });

  it('shows the views only to the owner', () => {
    expect(render('signed-out').nativeElement.querySelector('nav')).toBeNull();
    TestBed.resetTestingModule();
    expect(
      render('granted').nativeElement.querySelector('nav')?.textContent
    ).toContain('Overview');
  });
});
