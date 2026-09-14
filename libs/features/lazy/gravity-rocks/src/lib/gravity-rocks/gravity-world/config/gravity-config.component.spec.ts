/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { qaSelector } from '@wolsok/test-helper';
import { take } from 'rxjs';
import { GravityWorldConfig } from '../domain/gravity-world-config';
import { GravityConfigComponent } from './gravity-config.component';

/** Element carrying the given `data-qa` attribute, or null. */
function getByQa<T extends HTMLElement>(
  fixture: ComponentFixture<GravityConfigComponent>,
  qa: string
): T | null {
  return fixture.nativeElement.querySelector(qaSelector(qa));
}

describe('GravityConfigComponent', () => {
  let fixture: ComponentFixture<GravityConfigComponent>;
  let component: GravityConfigComponent;
  const initialConfig: GravityWorldConfig = {
    gravitationalConstant: 10,
    massOfSun: 10000,
    showTrail: true,
    trailLength: 100,
    simulationSpeed: 1,
  };
  let emitted: GravityWorldConfig[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GravityConfigComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GravityConfigComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.configChange.pipe(take(10)).subscribe((c) => emitted.push(c));
    component.config = initialConfig;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a form', () => {
    expect(getByQa(fixture, 'form')).toBeTruthy();
  });

  it('should have inputs', () => {
    expect(getByQa<HTMLInputElement>(fixture, 'gConstant')).toBeTruthy();
    expect(getByQa<HTMLInputElement>(fixture, 'massOfSun')).toBeTruthy();
    expect(getByQa(fixture, 'showTrail')).toBeTruthy();
    expect(getByQa<HTMLInputElement>(fixture, 'trailLength')).toBeTruthy();
    expect(getByQa<HTMLInputElement>(fixture, 'simulationSpeed')).toBeTruthy();
  });

  it('should put the speed slider on the log scale of the speed', () => {
    component.config = { ...initialConfig, simulationSpeed: 10 };
    expect(component.speedExponent).toBe(1);

    component.config = { ...initialConfig, simulationSpeed: 0.1 };
    expect(component.speedExponent).toBe(-1);
  });

  it('should read a speed back off the slider', () => {
    component.setSpeedExponent(0);
    expect(component.form.controls.simulationSpeed.value).toBe(1);

    component.setSpeedExponent(-1);
    expect(component.form.controls.simulationSpeed.value).toBe(0.1);

    component.setSpeedExponent(0.5);
    // rounded to what the label shows
    expect(component.form.controls.simulationSpeed.value).toBe(3.16);
  });

  it('should fall back to the normal speed when there is none', () => {
    component.config = { ...initialConfig, simulationSpeed: 0 };

    // the same fallback the simulation makes, so the label tells the truth
    expect(component.simulationSpeed).toBe(1);
    expect(component.speedExponent).toBe(0);
  });

  it('should set initial form values', () => {
    expect(component.form.getRawValue()).toEqual(initialConfig);
    const gInput = getByQa<HTMLInputElement>(fixture, 'gConstant');
    const massInput = getByQa<HTMLInputElement>(fixture, 'massOfSun');
    expect(gInput?.value).toBe('' + initialConfig.gravitationalConstant);
    expect(massInput?.value).toBe('' + initialConfig.massOfSun);
  });

  it('should patch when config input changes', () => {
    component.config = {
      ...initialConfig,
      gravitationalConstant: 20,
      massOfSun: 20000,
    };
    fixture.detectChanges();
    const gInput = getByQa<HTMLInputElement>(fixture, 'gConstant');
    const massInput = getByQa<HTMLInputElement>(fixture, 'massOfSun');
    expect(gInput?.value).toBe('20');
    expect(massInput?.value).toBe('20000');
  });

  it('should emit when values change', async () => {
    const gInput = getByQa<HTMLInputElement>(fixture, 'gConstant')!;
    gInput.value = '20';
    gInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const massInput = getByQa<HTMLInputElement>(fixture, 'massOfSun')!;
    massInput.value = '20000000';
    massInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // last emitted should reflect updated
    const last = emitted[emitted.length - 1];
    expect(last.gravitationalConstant).toBe(20);
    expect(last.massOfSun).toBe(20000000);
  });

  it('should set the initial trail values', () => {
    const trailInput = getByQa<HTMLInputElement>(fixture, 'trailLength');
    expect(trailInput?.value).toBe('' + initialConfig.trailLength);
    expect(component.form.controls.showTrail.value).toBe(
      initialConfig.showTrail
    );
  });

  it('should emit when the trail is switched off', () => {
    component.form.controls.showTrail.setValue(false);
    fixture.detectChanges();
    expect(emitted[emitted.length - 1].showTrail).toBe(false);
  });

  it('should emit when the trail length changes', () => {
    component.form.controls.trailLength.setValue(300);
    fixture.detectChanges();
    expect(emitted[emitted.length - 1].trailLength).toBe(300);
  });

  it('should not emit for duplicate value', () => {
    const initialEmits = emitted.length;
    const gInput = getByQa<HTMLInputElement>(fixture, 'gConstant')!;
    gInput.value = '' + initialConfig.gravitationalConstant;
    gInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(emitted.length).toBe(initialEmits); // distinctUntilChanged
  });
});
