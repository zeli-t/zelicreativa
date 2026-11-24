import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';

export interface DatosDireccion {
  destinatario: string;
  calle: string;
  numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
}

export interface Direccion extends DatosDireccion {
  id: number;
}

export const CAMPOS_DIRECCION = [
  { id: 'destinatario', etiqueta: 'Destinatario', clase: 'col-md-6', autocomplete: 'name' },
  { id: 'calle', etiqueta: 'Calle', clase: 'col-md-8', autocomplete: 'address-line1' },
  { id: 'numero', etiqueta: 'Número', clase: 'col-md-4', autocomplete: 'off' },
  { id: 'colonia', etiqueta: 'Colonia', clase: 'col-md-4', autocomplete: 'address-level3' },
  { id: 'ciudad', etiqueta: 'Ciudad', clase: 'col-md-4', autocomplete: 'address-level2' },
  { id: 'estado', etiqueta: 'Estado', clase: 'col-md-4', autocomplete: 'address-level1' },
  { id: 'codigo_postal', etiqueta: 'Código postal', clase: 'col-md-4', autocomplete: 'postal-code' },
] as const;

export function direccionVacia(): DatosDireccion {
  return { destinatario: '', calle: '', numero: '', colonia: '', ciudad: '', estado: '', codigo_postal: '' };
}

export function campoDireccionValido(datos: DatosDireccion, campo: keyof DatosDireccion): boolean {
  const valor = datos[campo].trim();
  return campo === 'codigo_postal' ? /^\d{5}$/.test(valor) : valor.length > 0;
}

const campos = ['id', ...CAMPOS_DIRECCION.map(campo => campo.id)].join(',');
const editables = (datos: DatosDireccion) => Object.fromEntries(
  CAMPOS_DIRECCION.map(({ id }) => [id, datos[id].trim()]),
);

@Injectable({ providedIn: 'root' })
export class Direcciones {
  private readonly auth = inject(Autenticacion);
  readonly edicionHabilitada = environment.checkoutSimulado;

  async listar(usuarioId: string): Promise<Direccion[]> {
    const consulta = new URLSearchParams({
      select: campos,
      usuario_id: 'eq.' + usuarioId,
      activa: 'eq.true',
      order: 'principal.desc,id.desc',
    });
    return this.consultar(usuarioId, consulta);
  }

  async guardar(usuarioId: string, datos: DatosDireccion): Promise<Direccion> {
    const filas = await this.consultar(usuarioId, new URLSearchParams({ select: campos }), 'POST', {
      usuario_id: usuarioId, ...editables(datos),
    });
    if (filas.length !== 1) throw new Error('DIRECCION_NO_CONFIRMADA');
    return filas[0];
  }

  async editar(usuarioId: string, id: number, datos: DatosDireccion): Promise<Direccion> {
    return this.modificar(usuarioId, id, editables(datos));
  }

  async quitar(usuarioId: string, id: number): Promise<void> {
    await this.modificar(usuarioId, id, { activa: false });
  }

  private async modificar(usuarioId: string, id: number, cambios: object): Promise<Direccion> {
    if (!this.edicionHabilitada) throw new Error('CUENTA_DESHABILITADA');
    const filtro = new URLSearchParams({
      select: campos, id: 'eq.' + id, usuario_id: 'eq.' + usuarioId, activa: 'eq.true',
    });
    const filas = await this.consultar(usuarioId, filtro, 'PATCH', cambios);
    if (filas.length !== 1) throw new Error('DIRECCION_NO_CONFIRMADA');
    return filas[0];
  }

  private async consultar(usuarioId: string, consulta: URLSearchParams, metodo = 'GET', datos?: object): Promise<Direccion[]> {
    const sesion = this.auth.sesion();
    if (!sesion || sesion.user.id !== usuarioId) throw new Error('SESION_REQUERIDA');
    const cabeceras = new Headers({
      apikey: environment.supabasePublishableKey,
      Authorization: 'Bearer ' + sesion.access_token,
    });
    if (datos) {
      cabeceras.set('Content-Type', 'application/json');
      cabeceras.set('Prefer', 'return=representation');
    }
    const respuesta = await fetch(environment.supabaseUrl.replace(/\/$/, '') + '/rest/v1/direcciones?' + consulta, {
      method: metodo,
      headers: cabeceras,
      body: datos ? JSON.stringify(datos) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok || this.auth.sesion()?.user.id !== usuarioId) {
      throw new Error('DIRECCIONES_NO_DISPONIBLES');
    }
    const filas = await respuesta.json();
    if (this.auth.sesion()?.user.id !== usuarioId) throw new Error('DIRECCIONES_NO_DISPONIBLES');
    return filas;
  }
}
