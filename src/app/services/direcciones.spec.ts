import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';
import { DatosDireccion, Direcciones } from './direcciones';

describe('Direcciones', () => {
  const datos: DatosDireccion = {
    destinatario: 'Destinatario ficticio', calle: 'Calle de prueba', numero: '12 A',
    colonia: 'Centro', ciudad: 'Ciudad de prueba', estado: 'Estado de prueba', codigo_postal: '08801',
  };
  const sesion = signal<{ user: { id: string }; access_token: string } | null>(null);
  const solicitudes = vi.fn<typeof fetch>();

  const urlOriginal = environment.supabaseUrl;

  beforeEach(() => {
    environment.supabaseUrl = 'https://supabase.example.invalid';
    solicitudes.mockReset();
    sesion.set({ user: { id: 'cliente-a' }, access_token: 'token-ficticio' });
    vi.stubGlobal('fetch', solicitudes);
    TestBed.configureTestingModule({ providers: [{ provide: Autenticacion, useValue: { sesion } }] });
  });

  afterEach(() => {
    environment.supabaseUrl = urlOriginal;
    vi.unstubAllGlobals();
  });

  it('solicita únicamente las direcciones activas de la sesión actual', async () => {
    solicitudes.mockResolvedValue(new Response(JSON.stringify([{ id: 7, ...datos }])));
    expect(await TestBed.inject(Direcciones).listar('cliente-a')).toEqual([{ id: 7, ...datos }]);
    const [url, solicitud] = solicitudes.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('usuario_id')).toBe('eq.cliente-a');
    expect(new URL(String(url)).searchParams.get('activa')).toBe('eq.true');
    expect(new Headers(solicitud?.headers).get('Authorization')).toBe('Bearer token-ficticio');
  });

  it('envía los campos de dirección y fija el propietario con la sesión', async () => {
    solicitudes.mockResolvedValue(new Response(JSON.stringify([{ id: 7, ...datos }])));
    const entrada = { ...datos, usuario_id: 'cliente-b', correo: 'excluir@example.invalid' };
    expect(await TestBed.inject(Direcciones).guardar('cliente-a', entrada)).toEqual({ id: 7, ...datos });
    const [, solicitud] = solicitudes.mock.calls[0];
    expect(solicitud?.method).toBe('POST');
    expect(JSON.parse(String(solicitud?.body))).toEqual({ usuario_id: 'cliente-a', ...datos });
  });

  it('bloquea consultas sin sesión o para otro usuario sin enviar peticiones', async () => {
    const api = TestBed.inject(Direcciones);
    await expect(api.listar('cliente-b')).rejects.toThrow('SESION_REQUERIDA');
    sesion.set(null);
    await expect(api.guardar('cliente-a', datos)).rejects.toThrow('SESION_REQUERIDA');
    expect(solicitudes).not.toHaveBeenCalled();
  });

  it('descarta respuestas si la cuenta cambió y maneja errores de RLS', async () => {
    const api = TestBed.inject(Direcciones);
    solicitudes.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(api.listar('cliente-a')).rejects.toThrow('DIRECCIONES_NO_DISPONIBLES');
    solicitudes.mockImplementationOnce(async () => {
      sesion.set({ user: { id: 'cliente-b' }, access_token: 'otro-token-ficticio' });
      return new Response(JSON.stringify([{ id: 7, ...datos }]));
    });
    await expect(api.listar('cliente-a')).rejects.toThrow('DIRECCIONES_NO_DISPONIBLES');
  });

  it('edita y retira solo una dirección propia activa, sin borrar su fila', async () => {
    const api = TestBed.inject(Direcciones);
    Object.defineProperty(api, 'edicionHabilitada', { value: true });
    solicitudes.mockImplementation(async () => Response.json([{ id: 7, ...datos }]));
    const entrada = { ...datos, usuario_id: 'cliente-b', activa: false };
    await api.editar('cliente-a', 7, entrada);
    await api.quitar('cliente-a', 7);
    for (const [url, init] of solicitudes.mock.calls) {
      const filtro = new URL(String(url)).searchParams;
      expect(filtro.get('id')).toBe('eq.7');
      expect(filtro.get('usuario_id')).toBe('eq.cliente-a');
      expect(filtro.get('activa')).toBe('eq.true');
      expect(init?.method).toBe('PATCH');
    }
    expect(JSON.parse(String(solicitudes.mock.calls[0][1]?.body))).toEqual(datos);
    expect(JSON.parse(String(solicitudes.mock.calls[1][1]?.body))).toEqual({ activa: false });
  });

  it('rechaza una edición sin alcance y una retirada que RLS deja sin filas', async () => {
    const api = TestBed.inject(Direcciones);
    Object.defineProperty(api, 'edicionHabilitada', { value: true });
    await expect(api.editar('cliente-b', 7, datos)).rejects.toThrow('SESION_REQUERIDA');
    expect(solicitudes).not.toHaveBeenCalled();
    solicitudes.mockResolvedValueOnce(Response.json([]));
    await expect(api.quitar('cliente-a', 7)).rejects.toThrow('DIRECCION_NO_CONFIRMADA');
  });
});
