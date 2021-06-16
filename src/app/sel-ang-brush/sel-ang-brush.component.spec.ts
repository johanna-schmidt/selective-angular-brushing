import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelAngBrushComponent } from './sel-ang-brush.component';

describe('SelAngBrushComponent', () => {
  let component: SelAngBrushComponent;
  let fixture: ComponentFixture<SelAngBrushComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelAngBrushComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelAngBrushComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
