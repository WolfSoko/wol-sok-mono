import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { GravityRocksComponent } from './gravity-rocks.component';

describe('GravityRocksAppComponent', () => {
  let component: GravityRocksComponent;
  let fixture: ComponentFixture<GravityRocksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GravityRocksComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(GravityRocksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
