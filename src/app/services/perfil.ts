import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';

export interface DatosPerfil { nombre: string; telefono: string | null }
export interface PerfilPropio extends DatosPerfil { activo: boolean }

@Injectable({ providedIn: 'root' })
export class Perfil {
  private readonly auth = inject(Autenticacion);
  private readonly guardado = signal<{ usuario: string; datos: PerfilPropio } | null>(null);
  private carga?: { usuario: string; resultado: Promise<PerfilPropio> };
  readonly habilitado = environment.checkoutSimulado;
  readonly nombre = computed(() => {
    const perfil = this.guardado();
    return perfil && perfil.usuario === this.auth.sesion()?.user.id ? perfil.datos.nombre : null;
  });

  obtener(usuario: string): Promise<PerfilPropio> {
    if (this.carga?.usuario === usuario) return this.carga.resultado;
    const resultado = this.consultar(usuario).finally(() => {
      if (this.carga?.resultado === resultado) this.carga = undefined;
    });
    this.carga = { usuario, resultado };
    return resultado;
  }

  guardar(usuario: string, datos: DatosPerfil): Promise<PerfilPropio> {
    const nombre = datos.nombre.trim();
    if (!nombre || nombre.length > 100) return Promise.reject(new Error('NOMBRE_INVALIDO'));
    return this.consultar(usuario, { nombre, telefono: datos.telefono?.trim() || null });
  }

  private async consultar(usuario: string, cambios?: DatosPerfil): Promise<PerfilPropio> {
    if (!this.habilitado) throw new Error('CUENTA_DESHABILITADA');
    const sesion = this.auth.sesion();
    if (!sesion || sesion.user.id !== usuario) throw new Error('SESION_REQUERIDA');
    const consulta = new URLSearchParams({ id: 'eq.' + usuario, select: 'nombre,telefono,activo' });
    const respuesta = await fetch(environment.supabaseUrl.replace(/\/$/, '') + '/rest/v1/usuarios?' + consulta, {
      method: cambios ? 'PATCH' : 'GET',
      headers: {
        apikey: environment.supabasePublishableKey,
        Authorization: 'Bearer ' + sesion.access_token,
        ...(cambios ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
      },
      body: cambios ? JSON.stringify(cambios) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok) throw new Error('PERFIL_NO_DISPONIBLE');
    const filas: PerfilPropio[] = await respuesta.json();
    if (this.auth.sesion()?.user.id !== usuario) throw new Error('SESION_REQUERIDA');
    if (filas.length !== 1) throw new Error('PERFIL_NO_CONFIRMADO');
    this.guardado.set({ usuario, datos: filas[0] });
    return filas[0];
  }
}
