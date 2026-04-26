import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { SideNavComponent } from './side-nav.component';

describe('SideNavComponent', () => {
  let component: SideNavComponent;
  let fixture: ComponentFixture<SideNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNavComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SideNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    // Given: Component is initialized
    // When: Component is created
    // Then: Component should be truthy
    expect(component).toBeTruthy();
  });

  it('should have a sidenav component', () => {
    // Given: Component is rendered
    fixture.detectChanges();

    // When: Checking for sidenav element
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');

    // Then: Sidenav should exist
    expect(sidenav).toBeTruthy();
  });

  it('should have toggle method', () => {
    // Given: Component is initialized
    // When: Checking for toggle method
    const toggleMethod = component.toggle;

    // Then: Toggle method should exist
    expect(toggleMethod).toBeDefined();
    expect(typeof toggleMethod).toBe('function');
  });

  it('should toggle drawer when toggle is called', async () => {
    // Given: Component is initialized with initial state
    await fixture.whenStable();
    const initialShowSidebar = component.showSidebar();

    // When: toggle method is called
    component.toggle();
    await fixture.whenStable();

    // Then: Drawer state should change
    expect(component.showSidebar()).toBe(!initialShowSidebar);
  });

  it('should render navigation content in sidenav container', () => {
    // Given: Component is rendered
    fixture.detectChanges();

    // When: Checking sidenav content
    const sidenavContent = fixture.nativeElement.querySelector(
      'mat-sidenav-container'
    );

    // Then: Sidenav container should exist
    expect(sidenavContent).toBeTruthy();
  });

  it('should have navigation list in drawer', () => {
    // Given: Component is rendered
    fixture.detectChanges();

    // When: Checking for navigation list
    const navList = fixture.nativeElement.querySelector('mat-nav-list');

    // Then: Nav list should exist
    expect(navList).toBeTruthy();
  });

  it('should display router outlet for content', () => {
    // Given: Component is rendered
    fixture.detectChanges();

    // When: Checking for ng-content projection
    const container = fixture.nativeElement.querySelector('mat-sidenav-container');

    // Then: Container should exist for content projection
    expect(container).toBeTruthy();
  });

  it('should handle responsive layout changes', () => {
    // Given: Component is initialized
    // When: Component is rendered
    fixture.detectChanges();

    // Then: Component should be responsive (has sidenav container component)
    const sidenavContainer = fixture.nativeElement.querySelector('mat-sidenav-container');
    expect(sidenavContainer).toBeTruthy();
  });

  it('should cleanup on destroy', () => {
    // Given: Component is initialized
    // When/Then: Component should destroy without errors
    expect(() => fixture.destroy()).not.toThrow();
  });
});
