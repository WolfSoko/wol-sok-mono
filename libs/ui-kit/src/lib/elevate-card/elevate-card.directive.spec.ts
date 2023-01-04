import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ElevateCardDirective } from './elevate-card.directive';

@Component({
  standalone: true,
  imports: [ElevateCardDirective],
  template: ` <div wsSharedUiElevateCard class="classThatShouldNotBeDeleted" [elevationLevel]="15"></div> `,
})
class TestElevateCardComponent {}

describe('ElevateCard directive', () => {
  let fixture: ComponentFixture<TestElevateCardComponent>;
  let de: DebugElement;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestElevateCardComponent], // declare the test component
    });

    fixture = TestBed.createComponent(TestElevateCardComponent);

    // query for the title <h1> by CSS element selector
    de = fixture.debugElement.query(By.css('div'));
    el = de.nativeElement;

    // init bindings
    fixture.detectChanges();
  });

  afterEach(() => {
    thenOtherClassesShouldNotBeDeleted();
  });

  it('should not have the mat-elevation class initially', () => {
    thenElevationClassShouldNotBeSet();
  });

  it('should add elevation class on mouseenter', () => {
    de.triggerEventHandler('mouseenter', undefined);
    fixture.detectChanges();
    thenElevationClassShouldBeSet();
  });

  it('should remove elevation class on mouseleave', () => {
    de.triggerEventHandler('mouseenter', undefined);
    fixture.detectChanges();
    thenElevationClassShouldBeSet();
    de.triggerEventHandler('mouseleave', undefined);
    fixture.detectChanges();
    thenElevationClassShouldNotBeSet();
  });

  function thenElevationClassShouldNotBeSet() {
    expect(el.classList.contains('mat-elevation-z15')).toBeFalsy();
    expect(el.classList.contains('mat-mdc-elevation-specific')).toBeFalsy();
  }

  function thenElevationClassShouldBeSet() {
    expect(el.classList.contains('mat-elevation-z15')).toBeTruthy();
    expect(el.classList.contains('mat-mdc-elevation-specific')).toBeTruthy();
  }

  function thenOtherClassesShouldNotBeDeleted() {
    expect(el.classList.contains('classThatShouldNotBeDeleted')).toBeTruthy();
  }
});
