import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SomeGpuCalculationComponent } from './some-gpu-calculation.component';

describe('SomeGpuCalculationComponent', () => {
  let component: SomeGpuCalculationComponent;
  let fixture: ComponentFixture<SomeGpuCalculationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SomeGpuCalculationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SomeGpuCalculationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
