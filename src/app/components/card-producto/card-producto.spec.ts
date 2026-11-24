import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { QuickView } from '../quick-view/quick-view';
import { catalogoDePrueba, instalarAlmacenamientoDePrueba } from '../../testing/entorno-pruebas';
import { CardProducto } from './card-producto';

describe('CardProducto', () => {
  let fixture: ComponentFixture<CardProducto>;

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    instalarAlmacenamientoDePrueba({ favoritosZeli: '[]' });
    await TestBed.configureTestingModule({
      declarations: [CardProducto, QuickView],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([]), catalogoDePrueba()],
    }).compileComponents();

    fixture = TestBed.createComponent(CardProducto);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
