import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';
import { Perfil } from './perfil';

describe('Perfil del cliente', () => {
  const sesion = signal({ user: { id: 'cliente-a' }, access_token: 'ficticio' });
  const peticion = vi.fn<typeof fetch>();
  let api: Perfil;

  const urlOriginal = environment.supabaseUrl;

  beforeEach(() => {
    environment.supabaseUrl = 'https://supabase.example.invalid';
    sesion.set({ user: { id: 'cliente-a' }, access_token: 'ficticio' });
    peticion.mockReset();
    vi.stubGlobal('fetch', peticion);
    TestBed.configureTestingModule({ providers: [{ provide: Autenticacion, useValue: { sesion } }] });
    api = TestBed.inject(Perfil);
    Object.defineProperty(api, 'habilitado', { value: true });
  });

  afterEach(() => {
    environment.supabaseUrl = urlOriginal;
    vi.unstubAllGlobals();
  });

  it('actualiza solo nombre y teléfono y usa el propietario de la sesión', async () => {
    peticion.mockResolvedValueOnce(Response.json([{ nombre: 'Itzel', telefono: null, activo: true }]));
    const datos = { nombre: ' Itzel ', telefono: ' ', rol: 'admin', activo: false };
    await api.guardar('cliente-a', datos);
    const [url, init] = peticion.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('id')).toBe('eq.cliente-a');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ nombre: 'Itzel', telefono: null });
    expect(api.nombre()).toBe('Itzel');
    sesion.set({ user: { id: 'cliente-b' }, access_token: 'otro-ficticio' });
    expect(api.nombre()).toBeNull();
  });

  it('deniega cuentas ajenas y un perfil que no se pudo actualizar', async () => {
    await expect(api.obtener('cliente-b')).rejects.toThrow('SESION_REQUERIDA');
    expect(peticion).not.toHaveBeenCalled();
    peticion.mockResolvedValueOnce(Response.json([]));
    await expect(api.guardar('cliente-a', { nombre: 'Itzel', telefono: null })).rejects.toThrow('PERFIL_NO_CONFIRMADO');
  });
});
