import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShowFpsComponent } from './show-fps.component';

describe('ShowFpsComponent', () => {
  let fixture: ComponentFixture<ShowFpsComponent>;
  let compRef: ComponentRef<ShowFpsComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ShowFpsComponent);
    compRef = fixture.componentRef;
  });
  it('should create component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show fps when show is true', () => {
    setInput(40.1, true);
    expect(getFpsText()).toBe('40.1 FPS');
  });

  it('should hide when show is false', () => {
    setInput(50, false);
    expect(getFpsText()).toBeNull();
  });

  it('should update fps when value changes', () => {
    setInput(40.1, true);
    expect(getFpsText()).toBe('40.1 FPS');
    setInput(30.2);
    expect(getFpsText()).toBe('30.2 FPS');
  });

  it('should hide after being visible when toggled', () => {
    setInput(60, true);
    fixture.detectChanges();
    expect(getFpsText()).toBe('60.0 FPS');
    setInput(undefined, false);
    fixture.detectChanges();
    expect(getFpsText()).toBeNull();
  });

  function getFpsText() {
    return (
      (fixture.nativeElement.querySelector('.ws-ui-show-fps') as HTMLElement)
        ?.textContent ?? null
    );
  }

  function setInput(fps?: number, show?: boolean) {
    if (typeof fps !== 'undefined') compRef.setInput('fps', fps);
    if (typeof show !== 'undefined') compRef.setInput('show', show);
    fixture.detectChanges();
  }
});
