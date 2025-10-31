import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { TechnologyComponent } from './technology.component';

describe('TechnologyComponent', () => {
  let component: TechnologyComponent;
  let fixture: ComponentFixture<TechnologyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnologyComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TechnologyComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    // Given: Component is initialized
    // When: Component is created
    // Then: Component should be truthy
    expect(component).toBeTruthy();
  });

  it('should display technology information', () => {
    // Given: Component has required inputs
    fixture.componentRef.setInput('title', 'Angular+');
    fixture.componentRef.setInput('link', 'https://angular.io');
    fixture.componentRef.setInput('image', 'assets/logos/angular.svg');
    fixture.detectChanges();

    // When: Accessing component properties
    const title = component.title;
    const link = component.link;
    const image = component.image;

    // Then: Properties should match inputs
    expect(title).toBe('Angular+');
    expect(link).toBe('https://angular.io');
    expect(image).toBe('assets/logos/angular.svg');
  });

  it('should have autoVaporize input defaulting to false', () => {
    // Given: Component is created without autoVaporize input
    fixture.detectChanges();

    // When: Checking autoVaporize property
    const autoVaporize = component.autoVaporize;

    // Then: Should default to false
    expect(autoVaporize).toBe(false);
  });

  it('should have autoVaporizeAfter input defaulting to 1000ms', () => {
    // Given: Component is created without autoVaporizeAfter input
    fixture.detectChanges();

    // When: Checking autoVaporizeAfter property
    const autoVaporizeAfter = component.autoVaporizeAfter;

    // Then: Should default to 1000
    expect(autoVaporizeAfter).toBe(1000);
  });

  it('should accept autoVaporize input', () => {
    // Given: Component is created
    // When: Setting autoVaporize to true
    fixture.componentRef.setInput('autoVaporize', true);
    fixture.detectChanges();

    // Then: autoVaporize should be true
    expect(component.autoVaporize).toBe(true);
  });

  it('should accept autoVaporizeAfter input', () => {
    // Given: Component is created
    // When: Setting autoVaporizeAfter to custom value
    fixture.componentRef.setInput('autoVaporizeAfter', 5000);
    fixture.detectChanges();

    // Then: autoVaporizeAfter should be 5000
    expect(component.autoVaporizeAfter).toBe(5000);
  });

  it('should have vaporizeAndScrollIntoView method', () => {
    // Given: Component is initialized with required inputs
    fixture.componentRef.setInput('title', 'Test');
    fixture.componentRef.setInput('link', 'https://test.com');
    fixture.componentRef.setInput('image', 'test.png');
    fixture.detectChanges();

    // When: Checking for method
    const method = component.vaporizeAndScrollIntoView;

    // Then: Method should exist
    expect(method).toBeDefined();
    expect(typeof method).toBe('function');
  });

  it('should call vaporize when autoVaporize is true', (done) => {
    // Given: Component with autoVaporize enabled and short delay
    fixture.componentRef.setInput('title', 'Test');
    fixture.componentRef.setInput('link', 'https://test.com');
    fixture.componentRef.setInput('image', 'test.png');
    fixture.componentRef.setInput('autoVaporize', true);
    fixture.componentRef.setInput('autoVaporizeAfter', 100);

    // Mock the thanos directive
    const mockVaporize$ = of({ state: 'completed' } as any);
    const thanosDirective = {
      vaporize$: jest.fn().mockReturnValue(mockVaporize$),
    };

    // When: Component initializes
    fixture.detectChanges();
    component.thanos = thanosDirective as any;
    component.ngOnInit();

    // Then: After timeout, vaporize should be triggered
    setTimeout(() => {
      expect(thanosDirective.vaporize$).toHaveBeenCalled();
      done();
    }, 150);
  });

  it('should not call vaporize when autoVaporize is false', (done) => {
    // Given: Component with autoVaporize disabled
    fixture.componentRef.setInput('title', 'Test');
    fixture.componentRef.setInput('link', 'https://test.com');
    fixture.componentRef.setInput('image', 'test.png');
    fixture.componentRef.setInput('autoVaporize', false);
    fixture.componentRef.setInput('autoVaporizeAfter', 100);

    // Mock the thanos directive
    const mockVaporize$ = of({ state: 'completed' } as any);
    const thanosDirective = {
      vaporize$: jest.fn().mockReturnValue(mockVaporize$),
    };

    // When: Component initializes
    fixture.detectChanges();
    component.thanos = thanosDirective as any;
    component.ngOnInit();

    // Then: Vaporize should not be called
    setTimeout(() => {
      expect(thanosDirective.vaporize$).not.toHaveBeenCalled();
      done();
    }, 150);
  });

  it('should scroll element into view when vaporizing', () => {
    // Given: Component is initialized
    fixture.componentRef.setInput('title', 'Test');
    fixture.componentRef.setInput('link', 'https://test.com');
    fixture.componentRef.setInput('image', 'test.png');
    fixture.detectChanges();

    // Mock thanos directive and scrollIntoView
    const mockVaporize$ = of({ state: 'completed' } as any);
    component.thanos = {
      vaporize$: jest.fn().mockReturnValue(mockVaporize$),
    } as any;

    const scrollIntoViewSpy = jest.fn();
    (component as any).elemRef.nativeElement.scrollIntoView = scrollIntoViewSpy;

    // When: vaporizeAndScrollIntoView is called
    component.vaporizeAndScrollIntoView();

    // Then: scrollIntoView should be called with smooth behavior
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  });
});
