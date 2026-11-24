import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { catalogoDePrueba } from '../../testing/entorno-pruebas';
import { DetalleProducto } from './detalle-producto';

describe('DetalleProducto', () => {
  let fixture: ComponentFixture<DetalleProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetalleProducto],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([]), catalogoDePrueba()],
    }).compileComponents();

    fixture = TestBed.createComponent(DetalleProducto);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
