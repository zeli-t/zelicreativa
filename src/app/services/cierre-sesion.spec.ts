import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Autenticacion } from './autenticacion';
import { CierreSesion } from './cierre-sesion';

describe('Confirmación de cierre de sesión', () => {
  const sesion = signal<{ user: { id: string } } | null>(null);
  const salir = vi.fn<() => Promise<void>>();
  const navegar = vi.fn(async () => true);
  const router = { url: '/mis-pedidos', navigate: navegar };
  let cierre: CierreSesion;

  beforeEach(() => {
    vi.useFakeTimers();
    sesion.set({ user: { id: 'ficticio' } });
    salir.mockReset();
    navegar.mockReset().mockResolvedValue(true);
    router.url = '/mis-pedidos';
    TestBed.configureTestingModule({ providers: [
      { provide: Autenticacion, useValue: { sesion, salir } },
      { provide: Router, useValue: router },
    ] });
    cierre = TestBed.inject(CierreSesion);
  });

  afterEach(() => vi.useRealTimers());

  it('bloquea llamadas repetidas, confirma tras cerrar y navega dos segundos después', async () => {
    let completar!: () => void;
    salir.mockReturnValueOnce(new Promise<void>(resolve => {
      completar = () => { sesion.set(null); resolve(); };
    }));
    const operacion = cierre.salir();
    await cierre.salir();
    expect(salir).toHaveBeenCalledOnce();
    expect(cierre.pendiente()).toBe(true);
    expect(cierre.confirmado()).toBe(false);
    completar();
    await operacion;
    expect(cierre.pendiente()).toBe(false);
    expect(cierre.confirmado()).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(navegar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(navegar).toHaveBeenCalledExactlyOnceWith(['/inicio'], { replaceUrl: true });
    expect(cierre.confirmado()).toBe(false);
  });

  it('si falla conserva la sesión y no muestra éxito ni redirige', async () => {
    salir.mockRejectedValueOnce(new Error('fallo simulado'));
    await cierre.salir();
    await vi.advanceTimersByTimeAsync(3000);
    expect(cierre.error()).toContain('No pudimos cerrar la sesión');
    expect(cierre.confirmado()).toBe(false);
    expect(cierre.pendiente()).toBe(false);
    expect(sesion()).not.toBeNull();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('retira el mensaje a los dos segundos aunque una navegación sea cancelada', async () => {
    salir.mockResolvedValueOnce(undefined);
    navegar.mockResolvedValueOnce(false);
    await cierre.salir();
    await vi.advanceTimersByTimeAsync(2000);
    expect(cierre.confirmado()).toBe(false);
    expect(cierre.pendiente()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
