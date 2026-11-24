import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { CarritoLateral } from '../carrito-lateral/carrito-lateral';
import { vi } from 'vitest';
import { Autenticacion } from '../../services/autenticacion';
import { catalogoDePrueba } from '../../testing/entorno-pruebas';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  const sesion = signal<{ user: { user_metadata: { nombre: string } } } | null>(null);
  const salir = vi.fn(async () => sesion.set(null));

  beforeEach(async () => {
    sesion.set(null);
    salir.mockClear();
    await TestBed.configureTestingModule({
      declarations: [Header, CarritoLateral],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [
        provideRouter([]), catalogoDePrueba(),
        { provide: Autenticacion, useValue: { sesion, salir, iniciar: async () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('actualiza el acceso de cuenta al iniciar y cerrar sesión', async () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.acceso-cuenta')?.textContent).toContain('Iniciar sesión');
    sesion.set({ user: { user_metadata: { nombre: 'Itzel' } } });
    fixture.detectChanges();
    const cuenta = html.querySelector<HTMLDetailsElement>('.cuenta')!;
    expect(cuenta.querySelector('summary')?.textContent).toContain('Hola, Itzel');
    expect(cuenta.querySelector('a[href="/mis-pedidos"]')?.textContent).toContain('Mis pedidos');
    cuenta.open = true;
    cuenta.querySelector('button')?.click();
    await fixture.whenStable();
    expect(salir).toHaveBeenCalledOnce();
    expect(html.querySelector('.acceso-cuenta')?.textContent).toContain('Iniciar sesión');
  });
});
