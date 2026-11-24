import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';

export const VERSION_TERMINOS_COMPRA = 'demo-v1';

export interface Compra {
  p_items: { id: number; cantidad: number }[];
  p_direccion: number;
  p_telefono_entrega: string;
  p_cupon: string | null;
  p_terminos_version: string;
}

interface Importes {
  subtotal: number;
  iva: number;
  envio: number;
  descuento: number;
  total: number;
}

export interface Cotizacion extends Importes {
  estado: 'requiere_confirmacion';
}

export interface PedidoRegistrado {
  id: number;
  folio: string;
  total: number;
  estado: string;
}

export interface PedidoGuardado extends PedidoRegistrado, Importes {
  creado_en: string;
  cliente: { nombre: string } | null;
  detalle_pedido: {
    id: number;
    nombre_producto: string;
    nombre_variante: string;
    sku: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}

export interface PedidoEnLista extends PedidoRegistrado {
  creado_en: string;
}

export interface CantidadDevolucion { detalle_pedido_id: number; cantidad: number }

export interface ResumenDevolucion {
  estado: string;
  detalle_devolucion: CantidadDevolucion[];
}

export interface SolicitudDevolucion extends ResumenDevolucion {
  id: number;
  motivo: string;
  resolucion: string | null;
  creado_en: string;
  resuelto_en: string | null;
}

export interface PedidoEnSeguimiento extends PedidoGuardado {
  cliente: { nombre: string; activo: boolean } | null;
  envios: { numero_guia: string; estado: string; empresa: { nombre: string } | null } | null;
  historial_estados_pedido: { id: number; estado_nuevo: string; motivo: string; creado_en: string }[];
  solicitudes_devolucion: SolicitudDevolucion[];
}

export interface PedidoEnListaCliente extends PedidoEnLista {
  detalle_pedido: { id: number; cantidad: number }[];
  solicitudes_devolucion: ResumenDevolucion[];
}

export interface PartidaSolicitada { id: number; cantidad: number }

export function mensajePedido(error: unknown, alternativa: string): string {
  const codigo = error instanceof Error ? error.message : '';
  switch (codigo) {
    case 'SESION_REQUERIDA': return 'Tu sesión ya no permite continuar. Inicia sesión de nuevo.';
    case 'DIRECCION_INVALIDA': return 'La dirección ya no está disponible. Regresa y elige otra.';
    case 'STOCK_INSUFICIENTE_O_INVALIDO': return 'No hay existencias suficientes. Revisa las cantidades en el carrito.';
    case 'LIMITE_POR_VARIANTE_EXCEDIDO': return 'El máximo es de 10 unidades por variante.';
    case 'TELEFONO_ENTREGA_INVALIDO': return 'Revisa el teléfono de entrega.';
    case 'CUPON_INVALIDO':
    case 'CUPON_AGOTADO': return 'El cupón no está disponible. Regresa para cambiarlo o quitarlo.';
    case 'CORREO_ENTREGA_REQUERIDO': return 'La cuenta necesita un correo para registrar el pedido.';
    case 'IDEMPOTENCIA_EN_CONFLICTO': return 'No se pudo verificar este intento. Tu carrito se conserva.';
    case 'PAGO_SIMULADO_NO_DISPONIBLE': return 'El pago simulado no está disponible en este momento.';
    case 'DEVOLUCION_INVALIDA': return 'La devolución requiere una cuenta activa, un pedido entregado y un motivo válido.';
    case 'PARTIDA_AJENA_AL_PEDIDO': return 'Hay una partida que ya no corresponde a este pedido.';
    case 'CANTIDAD_DEVOLUCION_EXCEDIDA': return 'La cantidad supera las unidades disponibles para devolución. Actualiza el pedido.';
    case 'CONEXION': return 'No pudimos comunicarnos con el servidor. Reintenta desde aquí para recuperar el mismo intento.';
    default: return alternativa;
  }
}

@Injectable({ providedIn: 'root' })
export class Pedidos {
  private readonly auth = inject(Autenticacion);
  private readonly intentos = new Map<string, string>();
  readonly habilitado = environment.checkoutSimulado &&
    !!environment.supabaseUrl && environment.supabasePublishableKey.startsWith('sb_publishable_');

  async identificarIntento(usuario: string, compra: Compra): Promise<{ huella: string; clave: string }> {
    const datos = new TextEncoder().encode(JSON.stringify([environment.supabaseUrl, usuario, compra]));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    const huella = 'zeli-compra-' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    let clave = this.intentos.get(huella);
    if (!clave) {
      try { clave = sessionStorage.getItem(huella) ?? undefined; } catch { /* Memoria como respaldo. */ }
      clave ??= crypto.randomUUID();
      this.intentos.set(huella, clave);
      try { sessionStorage.setItem(huella, clave); } catch { /* El intento sigue en memoria. */ }
    }
    return { huella, clave };
  }

  cerrarIntento(huella: string): void {
    this.intentos.delete(huella);
    try { sessionStorage.removeItem(huella); } catch { /* El almacenamiento puede estar bloqueado. */ }
  }

  async registrar(usuario: string, compra: Compra, clave: string, total?: number): Promise<Cotizacion | PedidoRegistrado> {
    const resultado = await this.consultar<Cotizacion | PedidoRegistrado>(usuario, 'rpc/registrar_pedido', {
      ...compra, p_idempotencia: clave, p_total_confirmado: total ?? null,
    });
    if (resultado.estado === 'requiere_confirmacion'
      ? !('subtotal' in resultado) || !Number.isFinite(resultado.total)
      : !('id' in resultado) || !resultado.folio) {
      throw new Error('RESPUESTA_PEDIDO_INVALIDA');
    }
    return resultado;
  }

  async obtener(usuario: string, folio: string): Promise<PedidoEnSeguimiento | null> {
    const parametros = new URLSearchParams({
      select: [
        'id,folio,estado,creado_en,subtotal,iva,envio,descuento,total,cliente:usuarios(nombre,activo)',
        'detalle_pedido(id,nombre_producto,nombre_variante,sku,cantidad,precio_unitario,subtotal)',
        'envios(numero_guia,estado,empresa:empresas_paqueteria(nombre))',
        'historial_estados_pedido(id,estado_nuevo,motivo,creado_en)',
        'solicitudes_devolucion(id,estado,motivo,resolucion,creado_en,resuelto_en,detalle_devolucion(detalle_pedido_id,cantidad))',
      ].join(','),
      folio: 'eq.' + folio,
      usuario_id: 'eq.' + usuario,
      'detalle_pedido.order': 'id.asc',
      'historial_estados_pedido.order': 'id.asc',
      'solicitudes_devolucion.order': 'id.desc',
    });
    const filas = await this.consultar<PedidoEnSeguimiento[]>(usuario, 'pedidos?' + parametros);
    return filas[0] ?? null;
  }

  async listarPropios(usuario: string, pagina: number, tamano: number): Promise<PedidoEnListaCliente[]> {
    const parametros = new URLSearchParams({
      select: 'id,folio,estado,creado_en,total,detalle_pedido(id,cantidad),solicitudes_devolucion(estado,detalle_devolucion(detalle_pedido_id,cantidad))',
      usuario_id: 'eq.' + usuario,
      order: 'creado_en.desc,id.desc',
      offset: String(pagina * tamano),
      limit: String(tamano + 1),
    });
    return this.consultar<PedidoEnListaCliente[]>(usuario, 'pedidos?' + parametros);
  }

  solicitarDevolucion(usuario: string, pedido: number, partidas: PartidaSolicitada[], motivo: string): Promise<number> {
    return this.consultar<number>(usuario, 'rpc/solicitar_devolucion', {
      p_pedido: pedido, p_items: partidas, p_motivo: motivo,
    });
  }

  private async consultar<T>(usuario: string, recurso: string, datos?: object): Promise<T> {
    if (!this.habilitado) throw new Error('CHECKOUT_DESHABILITADO');
    const sesion = this.auth.sesion();
    if (!sesion || sesion.user.id !== usuario) throw new Error('SESION_REQUERIDA');
    let respuesta: Response;
    try {
      respuesta = await fetch(environment.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + recurso, {
        method: datos ? 'POST' : 'GET',
        headers: {
          apikey: environment.supabasePublishableKey,
          Authorization: 'Bearer ' + sesion.access_token,
          ...(datos ? { 'Content-Type': 'application/json' } : {}),
        },
        body: datos ? JSON.stringify(datos) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('CONEXION');
    }
    const resultado = await respuesta.json().catch(() => null);
    if (this.auth.sesion()?.user.id !== usuario || respuesta.status === 401 || respuesta.status === 403) {
      throw new Error('SESION_REQUERIDA');
    }
    if (!respuesta.ok) throw new Error(resultado?.message ?? 'CONEXION');
    if (!resultado) throw new Error('CONEXION');
    return resultado;
  }
}
