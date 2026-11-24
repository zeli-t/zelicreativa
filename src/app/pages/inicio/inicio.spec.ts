import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { Hero } from '../../components/hero/hero';
import { CardCategoria } from '../../components/card-categoria/card-categoria';
import { CardProducto } from '../../components/card-producto/card-producto';
import { QuickView } from '../../components/quick-view/quick-view';
import { catalogoDePrueba } from '../../testing/entorno-pruebas';
import { Inicio } from './inicio';

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Inicio, Hero, CardCategoria, CardProducto, QuickView],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([]), catalogoDePrueba()],
    }).compileComponents();

    fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
