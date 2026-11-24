import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { requiereAdmin } from '../pages/admin/acceso-admin';
import { Autenticacion } from './autenticacion';
import { Administracion, nombreComprador, siguientesEstados } from './administracion';

describe('Administración', () => {
  const sesion = signal<{ user: { id: string }; access_token: string } | null>(null);
  const solicitud = vi.fn<typeof fetch>();
  let api: Administracion;

  it('prioriza el nombre registrado del comprador y evita el marcador Cliente', () => {
    expect(nombreComprador({ nombre: ' Itzel ' }, 'Otra persona')).toBe('Itzel');
    expect(nombreComprador({ nombre: 'Cliente' }, 'Destinataria ficticia')).toBe('Destinataria ficticia (destinatario)');
  });

  const urlOriginal = environment.supabaseUrl;

  beforeEach(() => {
    environment.supabaseUrl = 'https://supabase.example.invalid';
    sesion.set(null);
    solicitud.mockReset();
    vi.stubGlobal('fetch', solicitud);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Autenticacion, useValue: { sesion, iniciar: async () => {} } }],
    });
    api = TestBed.inject(Administracion);
    Object.defineProperty(api, 'habilitado', { value: true });
  });

  afterEach(() => {
    environment.supabaseUrl = urlOriginal;
    vi.unstubAllGlobals();
  });

  function abrirPanel() {
    return TestBed.runInInjectionContext(() => requiereAdmin(new ActivatedRouteSnapshot(), {} as RouterStateSnapshot));
  }

  it('envía a inicio de sesión sin consultar datos si no hay una sesión', async () => {
    const destino = await abrirPanel() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(destino)).toBe('/iniciar-sesion?volver=admin');
    expect(solicitud).not.toHaveBeenCalled();
  });

  it('deniega a un cliente y no permite consultar pedidos administrativos', async () => {
    sesion.set({ user: { id: 'cliente-a' }, access_token: 'token-ficticio' });
    solicitud.mockResolvedValueOnce(Response.json([{ rol: 'cliente', activo: true }]));
    const destino = await abrirPanel() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(destino)).toBe('/acceso-admin');
    await expect(api.pedidos()).rejects.toThrow('ADMIN_REQUERIDO');
    expect(solicitud).toHaveBeenCalledOnce();
    const url = new URL(String(solicitud.mock.calls[0][0]));
    expect(url.pathname).toBe('/rest/v1/usuarios');
    expect(url.searchParams.get('id')).toBe('eq.cliente-a');
  });

  it('un administrador consulta pedidos y cambia estados mediante la RPC', async () => {
    sesion.set({ user: { id: 'admin-a' }, access_token: 'token-ficticio' });
    solicitud.mockResolvedValueOnce(Response.json([{ rol: 'admin', activo: true }]));
    expect(await abrirPanel()).toBe(true);
    const pedido = { id: 12, folio: 'folio-ficticio', estado: 'pagado' };
    solicitud.mockResolvedValueOnce(Response.json([pedido]));
    expect(await api.pedidos()).toEqual([pedido]);
    expect(siguientesEstados(pedido.estado)).toEqual(['preparando', 'cancelado']);
    expect(siguientesEstados('cancelado')).toEqual([]);

    solicitud.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.cambiarEstado(pedido.id, 'preparando', 'Pedido en preparación', null, null);
    const [recurso, configuracion] = solicitud.mock.calls[2];
    expect(new URL(String(recurso)).pathname).toBe('/rest/v1/rpc/cambiar_estado_pedido');
    expect(configuracion?.method).toBe('POST');
    expect(JSON.parse(String(configuracion?.body))).toEqual({
      p_pedido: 12, p_estado: 'preparando', p_motivo: 'Pedido en preparación', p_empresa: null, p_guia: null,
    });
    sesion.set({ user: { id: 'cliente-b' }, access_token: 'otro-token-ficticio' });
    await expect(api.detalle(pedido.id)).rejects.toThrow('ADMIN_REQUERIDO');
    expect(solicitud).toHaveBeenCalledTimes(3);
  });

  it('no reporta éxito si RLS impide que el cambio alcance el registro', async () => {
    sesion.set({ user: { id: 'admin-a' }, access_token: 'token-ficticio' });
    solicitud.mockResolvedValueOnce(Response.json([{ rol: 'admin', activo: true }]));
    await api.comprobarRol();
    solicitud.mockResolvedValueOnce(Response.json([]));
    await expect(api.cambiarVigencia('productos', 23, false)).rejects.toThrow('ADMIN_REQUERIDO');
  });
});
