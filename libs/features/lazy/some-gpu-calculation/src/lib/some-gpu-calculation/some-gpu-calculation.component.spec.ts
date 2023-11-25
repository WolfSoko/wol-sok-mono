import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpuAdapterService } from '@wolsok/utils-gpu-calc';
import { SomeGpuCalculationComponent } from './some-gpu-calculation.component';

describe('SomeGpuCalculationComponent', () => {
  let component: SomeGpuCalculationComponent;
  let fixture: ComponentFixture<SomeGpuCalculationComponent>;

  beforeEach(async () => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    await TestBed.configureTestingModule({
      imports: [SomeGpuCalculationComponent],
      providers: [
        { provide: GpuAdapterService, useValue: {} as GpuAdapterService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SomeGpuCalculationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
