import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarritoLateral } from './carrito-lateral';

describe('CarritoLateral', () => {
  let component: CarritoLateral;
  let fixture: ComponentFixture<CarritoLateral>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CarritoLateral],
    }).compileComponents();

    fixture = TestBed.createComponent(CarritoLateral);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
