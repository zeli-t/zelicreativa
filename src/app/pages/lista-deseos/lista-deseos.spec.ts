import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { instalarAlmacenamientoDePrueba } from '../../testing/entorno-pruebas';
import { ListaDeseos } from './lista-deseos';

describe('ListaDeseos', () => {
  let fixture: ComponentFixture<ListaDeseos>;

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    instalarAlmacenamientoDePrueba({ favoritosZeli: '[]' });
    await TestBed.configureTestingModule({
      declarations: [ListaDeseos],
      imports: [CommonModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaDeseos);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
