import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProfileCurtainComponent } from './profile-curtain.component';
import { ProfileGate } from './profile-gate';

@Component({
  imports: [ProfileCurtainComponent],
  template: `<feat-lazy-bac-game-profile-curtain>
    <button type="button">Play</button>
  </feat-lazy-bac-game-profile-curtain>`,
})
class HostComponent {}

describe('ProfileCurtainComponent', () => {
  const ready = signal(false);

  let fixture: ComponentFixture<HostComponent>;

  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [{ provide: ProfileGate, useValue: { ready } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function content(root: HTMLElement): HTMLElement {
    return root.querySelector('.content') as HTMLElement;
  }

  function spinner(root: HTMLElement): Element | null {
    return root.querySelector('mat-progress-spinner');
  }

  beforeEach(() => ready.set(false));

  it('hides the screens and shows the spinner while the profile loads', () => {
    const root = render();

    expect(content(root).classList).toContain('pending');
    expect(content(root).hasAttribute('inert')).toBe(true);
    expect(spinner(root)?.getAttribute('aria-label')).toBe(
      'Loading your profile…'
    );
    // Laid out all the same, so an open screen keeps its state.
    expect(root.querySelector('button')).not.toBeNull();
  });

  it('shows the screens once the profile is known', () => {
    const root = render();

    ready.set(true);
    fixture.detectChanges();

    expect(content(root).classList).not.toContain('pending');
    expect(content(root).hasAttribute('inert')).toBe(false);
    expect(spinner(root)).toBeNull();
  });

  it('gives the focus back once the curtain lifts', () => {
    ready.set(true);
    const root = render();
    document.body.append(root);
    const button = root.querySelector('button') as HTMLButtonElement;
    button.focus();

    ready.set(false);
    fixture.detectChanges();
    // Taken before the content went inert, while it still had the focus.
    const curtain = fixture.debugElement.query(
      By.directive(ProfileCurtainComponent)
    ).componentInstance as ProfileCurtainComponent;
    expect(curtain['focused']).toBe(button);
    button.blur(); // inert takes the focus away in a browser; jsdom does not
    ready.set(true);
    fixture.detectChanges();

    expect(document.activeElement).toBe(button);
    root.remove();
  });
});
