import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmacionPedido } from './confirmacion-pedido';

describe('ConfirmacionPedido', () => {
  let component: ConfirmacionPedido;
  let fixture: ComponentFixture<ConfirmacionPedido>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmacionPedido],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacionPedido);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
