import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Autenticacion } from './autenticacion';
import type { PedidoEnLista, PedidoGuardado } from './pedidos';

export interface CategoriaAdmin { id: number; slug: string; nombre: string; descripcion: string | null; activa: boolean }
export interface ProductoAdmin {
  id: number; categoria_id: number; slug: string; nombre: string; descripcion: string;
  precio: number; precio_anterior: number | null; activo: boolean;
}
export interface VarianteAdmin {
  id: number; producto_id: number; sku: string; nombre: string; precio_adicional: number;
  activa: boolean; predeterminada: boolean;
}
export interface CuponAdmin {
  id: number; codigo: string; descripcion: string | null; tipo: 'fijo' | 'porcentaje';
  valor: number; inicio: string; fin: string | null; limite_usos: number | null; activo: boolean;
}
export interface ClienteAdmin { id: string; nombre: string; telefono: string | null; rol: 'admin' | 'cliente'; activo: boolean; creado_en: string }
export interface ExistenciaAdmin { variante_id: number; cantidad: number; stock_minimo: number }
export interface MovimientoAdmin { id: number; variante_id: number; pedido_id: number | null; tipo: string; variacion: number; saldo: number; motivo: string; creado_en: string }
export interface PedidoAdmin extends PedidoEnLista { cliente: { nombre: string } | null; destinatario: string | null }
export interface DetalleAdmin extends PedidoGuardado {
  direccion_entrega: { destinatario?: string; calle?: string; numero?: string; colonia?: string; ciudad?: string; estado?: string; codigo_postal?: string };
  contacto_entrega: { correo?: string; telefono?: string } | null;
  historial_estados_pedido: { id: number; estado_nuevo: string; motivo: string; creado_en: string }[];
  envios: { numero_guia: string; estado: string; empresa: { nombre: string } | null } | null;
  pagos: { id: number; metodo: string; monto: number; estado: string }[];
}
export interface PaqueteriaAdmin { id: number; nombre: string }
export interface DevolucionAdmin {
  id: number; pedido_id: number; motivo: string; estado: string; resolucion: string | null; creado_en: string;
  pedido: { folio: string; cliente: { nombre: string } | null; destinatario: string | null } | null;
  detalle_devolucion: { detalle_pedido_id: number; cantidad: number; partida: { nombre_producto: string; nombre_variante: string } | null }[];
}

const transiciones: Readonly<Record<string, readonly string[]>> = {
  pagado: ['preparando', 'cancelado'],
  preparando: ['enviado', 'cancelado'],
  enviado: ['entregado'],
};

export function siguientesEstados(estado: string): readonly string[] {
  return transiciones[estado] ?? [];
}

export function nombreComprador(cliente: { nombre: string } | null, destinatario?: string | null): string {
  const nombre = cliente?.nombre?.trim();
  if (nombre && nombre.toLocaleLowerCase('es') !== 'cliente') return nombre;
  const entrega = destinatario?.trim();
  return entrega ? entrega + ' (destinatario)' : 'Sin nombre registrado';
}

export function mensajeAdmin(error: unknown): string {
  switch (error instanceof Error ? error.message : '') {
    case 'ADMIN_REQUERIDO': return 'Tu cuenta no tiene permiso de administración.';
    case 'SESION_REQUERIDA': return 'La sesión expiró. Vuelve a iniciar sesión.';
    case 'ADMIN_DESHABILITADO': return 'Abre el panel con el perfil checkout-test.';
    case 'CONEXION': return 'No se pudo conectar con Supabase. Comprueba el resultado antes de repetir una escritura.';
    case 'TRANSICION_PEDIDO_INVALIDA': return 'El estado ya no admite ese cambio o falta el motivo. Actualiza el pedido.';
    case 'ENVIO_INVALIDO': return 'Selecciona una paquetería activa e indica una guía válida.';
    case 'ENVIO_INEXISTENTE': return 'El pedido todavía no tiene un envío registrado.';
    case 'STOCK_INSUFICIENTE_O_INVALIDO': return 'El ajuste dejaría el inventario fuera del rango permitido.';
    case 'AJUSTE_INVALIDO': return 'Revisa el ajuste, el stock mínimo y el motivo.';
    case 'TRANSICION_DEVOLUCION_INVALIDA': return 'La devolución no admite ese cambio. Actualiza la lista.';
    case 'ASIGNACION_INVALIDA': return 'La función no permite cambiar el rol de tu propia cuenta.';
    case '23505': return 'Ya existe un registro con ese identificador, SKU, código o guía.';
    case '23503':
    case '23514':
    case '23502':
    case '22003': return 'Revisa los valores y las relaciones del registro.';
    default: return 'No pudimos completar la operación. Revisa los datos y vuelve a intentarlo.';
  }
}

@Injectable({ providedIn: 'root' })
export class Administracion {
  private readonly auth = inject(Autenticacion);
  private readonly autorizado = signal<string | null>(null);
  private comprobacion?: { usuario: string; resultado: Promise<boolean> };
  readonly habilitado = environment.checkoutSimulado && !!environment.supabaseUrl &&
    environment.supabasePublishableKey.startsWith('sb_publishable_');
  readonly esAdmin = computed(() => {
    const usuario = this.auth.sesion()?.user.id;
    return !!usuario && this.autorizado() === usuario && this.habilitado;
  });

  comprobarRol(): Promise<boolean> {
    const usuario = this.auth.sesion()?.user.id;
    if (!usuario || !this.habilitado) {
      this.autorizado.set(null);
      return Promise.resolve(false);
    }
    if (this.comprobacion?.usuario === usuario) return this.comprobacion.resultado;
    const consulta = new URLSearchParams({ select: 'rol,activo', id: 'eq.' + usuario });
    const resultado = this.peticion<{ rol: string; activo: boolean }[]>(usuario, 'usuarios?' + consulta)
      .then(([perfil]) => {
        if (this.auth.sesion()?.user.id !== usuario) return false;
        const permite = perfil?.rol === 'admin' && perfil.activo === true;
        this.autorizado.set(permite ? usuario : null);
        return permite;
      })
      .catch(error => {
        if (this.auth.sesion()?.user.id === usuario) this.autorizado.set(null);
        throw error;
      })
      .finally(() => {
        if (this.comprobacion?.resultado === resultado) this.comprobacion = undefined;
      });
    this.comprobacion = { usuario, resultado };
    return resultado;
  }

  pedidos() {
    return this.listar<PedidoAdmin>('pedidos',
      'id,folio,creado_en,total,estado,cliente:usuarios!pedidos_usuario_id_fkey(nombre),destinatario:direccion_entrega->>destinatario',
      'id.desc');
  }
  categorias() { return this.listar<CategoriaAdmin>('categorias', 'id,nombre,slug,descripcion,activa', 'id.asc'); }
  productos() {
    return this.listar<ProductoAdmin>('productos', 'id,categoria_id,nombre,slug,descripcion,precio,precio_anterior,activo', 'id.asc');
  }
  variantes() {
    return this.listar<VarianteAdmin>('variantes_producto', 'id,producto_id,sku,nombre,precio_adicional,activa,predeterminada', 'id.asc');
  }
  existencias() { return this.listar<ExistenciaAdmin>('inventario', 'variante_id,cantidad,stock_minimo', 'variante_id.asc'); }
  clientes() { return this.listar<ClienteAdmin>('usuarios', 'id,nombre,telefono,rol,activo,creado_en', 'creado_en.desc,id.asc'); }
  cupones() { return this.listar<CuponAdmin>('cupones', 'id,codigo,descripcion,tipo,valor,inicio,fin,limite_usos,activo', 'id.desc'); }
  paqueterias() { return this.listar<PaqueteriaAdmin>('empresas_paqueteria', 'id,nombre', 'id.asc', { activa: 'eq.true' }); }
  pagos() { return this.listar<{ monto: number; estado: string }>('pagos', 'monto,estado', 'id.asc'); }
  partidas() {
    return this.listar<{ pedido_id: number; nombre_producto: string; cantidad: number }>(
      'detalle_pedido', 'pedido_id,nombre_producto,cantidad', 'id.asc',
    );
  }
  devoluciones() {
    return this.listar<DevolucionAdmin>('solicitudes_devolucion',
      'id,pedido_id,motivo,estado,resolucion,creado_en,pedido:pedidos(folio,cliente:usuarios!pedidos_usuario_id_fkey(nombre),destinatario:direccion_entrega->>destinatario),detalle_devolucion(detalle_pedido_id,cantidad,partida:detalle_pedido(nombre_producto,nombre_variante))',
      'id.desc');
  }

  async movimientos(variante: number): Promise<MovimientoAdmin[]> {
    const consulta = new URLSearchParams({
      select: 'id,variante_id,pedido_id,tipo,variacion,saldo,motivo,creado_en',
      variante_id: 'eq.' + variante, order: 'id.desc', limit: '30',
    });
    return this.restringida('movimientos_inventario?' + consulta);
  }

  async detalle(id: number): Promise<DetalleAdmin> {
    const consulta = new URLSearchParams({
      id: 'eq.' + id,
      select: 'id,folio,estado,creado_en,subtotal,iva,envio,descuento,total,cliente:usuarios!pedidos_usuario_id_fkey(nombre),direccion_entrega,contacto_entrega,detalle_pedido(id,nombre_producto,nombre_variante,sku,cantidad,precio_unitario,subtotal),pagos(id,metodo,monto,estado),historial_estados_pedido(id,estado_nuevo,motivo,creado_en),envios(numero_guia,estado,empresa:empresas_paqueteria(nombre))',
      'detalle_pedido.order': 'id.asc', 'historial_estados_pedido.order': 'id.asc',
    });
    const [pedido] = await this.restringida<DetalleAdmin[]>('pedidos?' + consulta);
    if (!pedido) throw new Error('PEDIDO_INEXISTENTE');
    return pedido;
  }

  cambiarEstado(pedido: number, estado: string, motivo: string, empresa: number | null, guia: string | null) {
    return this.rpc('cambiar_estado_pedido', { p_pedido: pedido, p_estado: estado, p_motivo: motivo, p_empresa: empresa, p_guia: guia });
  }
  ajustarStock(variante: number, delta: number, motivo: string, minimo: number | null) {
    return this.rpc('ajustar_inventario', { p_variante: variante, p_delta: delta, p_motivo: motivo, p_stock_minimo: minimo });
  }
  asignarRol(usuario: string, rol: string) {
    return this.rpc('asignar_rol', { p_usuario: usuario, p_rol: rol });
  }
  resolverDevolucion(id: number, estado: string, resolucion: string, reponer: boolean) {
    return this.rpc('resolver_devolucion', { p_solicitud: id, p_estado: estado, p_resolucion: resolucion, p_reponer: reponer });
  }
  guardarCategoria(id: number | null, datos: Omit<CategoriaAdmin, 'id'>) { return this.guardar('categorias', id, datos); }
  guardarProducto(id: number | null, datos: Omit<ProductoAdmin, 'id'>) { return this.guardar('productos', id, datos); }
  guardarVariante(id: number | null, datos: Omit<VarianteAdmin, 'id'>) { return this.guardar('variantes_producto', id, datos); }
  guardarCupon(id: number | null, datos: Omit<CuponAdmin, 'id'>) { return this.guardar('cupones', id, datos); }
  cambiarVigencia(tabla: 'productos' | 'categorias' | 'variantes_producto' | 'cupones', id: number, activo: boolean) {
    return this.guardar(tabla, id, tabla === 'categorias' || tabla === 'variantes_producto' ? { activa: activo } : { activo });
  }

  private async listar<T>(tabla: string, select: string, order: string, filtros: Record<string, string> = {}): Promise<T[]> {
    const filas: T[] = [];
    const pagina = 200;
    while (true) {
      const consulta = new URLSearchParams({ ...filtros, select, order, limit: String(pagina), offset: String(filas.length) });
      const lote = await this.restringida<T[]>(tabla + '?' + consulta);
      filas.push(...lote);
      if (lote.length < pagina) return filas;
    }
  }

  private async guardar(tabla: string, id: number | null, datos: object): Promise<void> {
    const parametro = id === null ? '?select=id' : '?id=eq.' + id + '&select=id';
    const filas = await this.restringida<{ id: number }[]>(tabla + parametro, id === null ? 'POST' : 'PATCH', datos, true);
    if (filas.length !== 1) throw new Error('ADMIN_REQUERIDO');
  }

  private rpc(nombre: string, datos: object) {
    return this.restringida('rpc/' + nombre, 'POST', datos);
  }

  private restringida<T>(recurso: string, metodo?: string, datos?: object, representar?: boolean): Promise<T> {
    const usuario = this.auth.sesion()?.user.id;
    if (!usuario) return Promise.reject(new Error('SESION_REQUERIDA'));
    if (!this.esAdmin()) return Promise.reject(new Error('ADMIN_REQUERIDO'));
    return this.peticion(usuario, recurso, metodo, datos, representar);
  }

  private async peticion<T>(usuario: string, recurso: string, metodo = 'GET', datos?: object, representar = false): Promise<T> {
    if (!this.habilitado) throw new Error('ADMIN_DESHABILITADO');
    const sesion = this.auth.sesion();
    if (!sesion || sesion.user.id !== usuario) throw new Error('SESION_REQUERIDA');
    let respuesta: Response;
    try {
      respuesta = await fetch(environment.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + recurso, {
        method: metodo,
        headers: {
          apikey: environment.supabasePublishableKey,
          Authorization: 'Bearer ' + sesion.access_token,
          ...(datos ? { 'Content-Type': 'application/json' } : {}),
          ...(representar ? { Prefer: 'return=representation' } : {}),
        },
        body: datos ? JSON.stringify(datos) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('CONEXION');
    }
    const cuerpo = respuesta.status === 204 ? undefined : await respuesta.json().catch(() => undefined);
    if (this.auth.sesion()?.user.id !== usuario || respuesta.status === 401) throw new Error('SESION_REQUERIDA');
    if (respuesta.status === 403) {
      this.autorizado.set(null);
      throw new Error('ADMIN_REQUERIDO');
    }
    if (!respuesta.ok) {
      const codigo = cuerpo?.code;
      throw new Error(codigo === '22023' || codigo === 'P0001' ? cuerpo.message : codigo ?? 'CONEXION');
    }
    if (metodo === 'GET' && !cuerpo) throw new Error('CONEXION');
    return cuerpo as T;
  }
}
