import { CommonModule, DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Administracion, CategoriaAdmin, ClienteAdmin, CuponAdmin, DetalleAdmin, DevolucionAdmin,
  ExistenciaAdmin, mensajeAdmin, MovimientoAdmin, nombreComprador, PaqueteriaAdmin, PedidoAdmin, ProductoAdmin,
  siguientesEstados, VarianteAdmin,
} from '../../services/administracion';
import { Autenticacion } from '../../services/autenticacion';
import { Catalogo } from '../../services/catalogo';

type Seccion = 'inicio' | 'pedidos' | 'catalogo' | 'inventario' | 'clientes' | 'promociones' | 'devoluciones';
type Borrador<T extends { id: number }> = Omit<T, 'id'> & { id: number | null };

function fechaLocal(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  readonly api = inject(Administracion);
  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly catalogo = inject(Catalogo);
  private readonly auth = inject(Autenticacion);
  readonly usuario = computed(() => this.auth.sesion()?.user.id);
  readonly menu: { id: Seccion; nombre: string; icono: string }[] = [
    { id: 'inicio', nombre: 'Resumen', icono: 'bi-grid-1x2' },
    { id: 'pedidos', nombre: 'Pedidos', icono: 'bi-bag-check' },
    { id: 'catalogo', nombre: 'Catálogo', icono: 'bi-box-seam' },
    { id: 'inventario', nombre: 'Inventario', icono: 'bi-boxes' },
    { id: 'clientes', nombre: 'Clientes', icono: 'bi-people' },
    { id: 'promociones', nombre: 'Promociones', icono: 'bi-ticket-perforated' },
    { id: 'devoluciones', nombre: 'Devoluciones', icono: 'bi-arrow-return-left' },
  ];
  readonly seccion = signal<Seccion>('inicio');
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly exito = signal('');
  readonly pedidos = signal<PedidoAdmin[]>([]);
  readonly detalle = signal<DetalleAdmin | null>(null);
  readonly paqueterias = signal<PaqueteriaAdmin[]>([]);
  readonly productos = signal<ProductoAdmin[]>([]);
  readonly categorias = signal<CategoriaAdmin[]>([]);
  readonly variantes = signal<VarianteAdmin[]>([]);
  readonly existencias = signal<ExistenciaAdmin[]>([]);
  readonly movimientos = signal<MovimientoAdmin[]>([]);
  readonly varianteAbierta = signal<VarianteAdmin | null>(null);
  readonly clientes = signal<ClienteAdmin[]>([]);
  readonly cupones = signal<CuponAdmin[]>([]);
  readonly devoluciones = signal<DevolucionAdmin[]>([]);
  readonly indicadores = signal({ pedidos: 0, ventas: 0, productos: 0, productosPrueba: 0, existencias: 0, stockBajo: 0, devoluciones: 0 });
  readonly masVendidos = signal<{ nombre: string; cantidad: number }[]>([]);
  readonly nombresProducto = computed(() => new Map(this.productos().map(p => [p.id, p.nombre])));
  readonly nombresCategoria = computed(() => new Map(this.categorias().map(c => [c.id, c.nombre])));
  readonly inventarioPorVariante = computed(() => new Map(this.existencias().map(e => [e.variante_id, e])));
  readonly soloStockBajo = signal(false);
  readonly inventarioVisible = computed(() => this.soloStockBajo()
    ? this.variantes().filter(v => v.activa && this.stockBajo(this.inventarioPorVariante().get(v.id)))
    : this.variantes());
  readonly filtro = signal('');
  readonly pedidosVisibles = computed(() => {
    const filtro = this.filtro().trim().toLocaleLowerCase('es');
    return this.pedidos().filter(p => [p.folio, this.nombreComprador(p.cliente, p.destinatario), p.estado]
      .some(v => v.toLocaleLowerCase('es').includes(filtro)));
  });
  readonly nombreComprador = nombreComprador;
  readonly estados = computed(() => siguientesEstados(this.detalle()?.estado ?? ''));
  estado = '';
  motivo = '';
  empresa: number | null = null;
  guia = '';
  delta: number | null = null;
  minimo: number | null = null;
  motivoStock = '';
  categoria: Borrador<CategoriaAdmin> | null = null;
  producto: Borrador<ProductoAdmin> | null = null;
  variante: Borrador<VarianteAdmin> | null = null;
  cupon: Borrador<CuponAdmin> | null = null;
  devolucion: DevolucionAdmin | null = null;
  estadoDevolucion = '';
  resolucion = '';
  reponer = false;

  ngOnInit(): void { void this.actualizar(); }

  stockBajo(existencia: ExistenciaAdmin | undefined): boolean {
    return !existencia || existencia.cantidad <= existencia.stock_minimo;
  }

  origenPrueba(producto: ProductoAdmin): string {
    if (producto.slug === 'zeli-checkout-e2e') return 'Prueba de integración del checkout';
    if (producto.slug.startsWith('prueba-') && producto.descripcion === 'Prueba de checkout') return 'Prueba de seguridad del checkout';
    return '';
  }

  ir(seccion: Seccion): void {
    if (this.ocupado()) return;
    this.seccion.set(seccion);
    this.detalle.set(null);
    this.varianteAbierta.set(null);
    this.categoria = this.producto = this.variante = this.cupon = this.devolucion = null;
    void this.actualizar();
  }

  actualizar(): Promise<void> {
    return this.operar(async () => {
      switch (this.seccion()) {
        case 'inicio': await this.cargarResumen(); break;
        case 'pedidos': {
          await this.cargarPedidos();
          const detalle = this.detalle();
          if (detalle) await this.cargarPedido(detalle.id);
          break;
        }
        case 'catalogo': await this.cargarCatalogo(); break;
        case 'inventario': await this.cargarInventario(); break;
        case 'clientes': this.clientes.set(await this.api.clientes()); break;
        case 'promociones': this.cupones.set(await this.api.cupones()); break;
        case 'devoluciones': this.devoluciones.set(await this.api.devoluciones()); break;
      }
    });
  }

  verPedido(id: number): Promise<void> {
    return this.operar(async () => {
      this.detalle.set(null);
      await this.cargarPedido(id);
      this.enfocar('detalle-admin-pedido');
    });
  }

  verPedidoDevolucion(id: number): Promise<void> {
    return this.operar(async () => {
      this.seccion.set('pedidos');
      this.detalle.set(null);
      await Promise.all([this.cargarPedidos(), this.cargarPedido(id)]);
      this.enfocar('detalle-admin-pedido');
    });
  }

  private async cargarPedidos(): Promise<void> {
    const [pedidos, paqueterias] = await Promise.all([this.api.pedidos(), this.api.paqueterias()]);
    this.pedidos.set(pedidos);
    this.paqueterias.set(paqueterias);
  }

  private async cargarPedido(id: number): Promise<void> {
    this.detalle.set(await this.api.detalle(id));
    this.estado = '';
    this.motivo = '';
    this.guia = '';
    this.empresa = null;
  }

  guardarEstado(): Promise<void> {
    const pedido = this.detalle();
    const estado = this.estado;
    const motivo = this.motivo.trim();
    const guia = estado === 'enviado' ? this.guia.trim() : null;
    const empresa = estado === 'enviado' ? this.empresa : null;
    if (!pedido || !this.estados().includes(estado) || !motivo || (estado === 'enviado' && (!empresa || !guia))) return Promise.resolve();
    const aviso = estado === 'cancelado'
      ? '¿Cancelar el pedido, devolver sus unidades al inventario y registrar el reembolso simulado?'
      : '¿Cambiar el estado del pedido a ' + estado + '?';
    if (!this.confirmar(aviso)) return Promise.resolve();
    return this.operar(async () => {
      await this.api.cambiarEstado(pedido.id, estado, motivo, empresa, guia);
      this.exito.set('Estado del pedido actualizado.');
      const [pedidos] = await Promise.all([this.api.pedidos(), this.cargarPedido(pedido.id)]);
      this.pedidos.set(pedidos);
    });
  }

  editarCategoria(dato?: CategoriaAdmin): void {
    this.producto = this.variante = null;
    this.categoria = dato ? { ...dato } : { id: null, nombre: '', slug: '', descripcion: '', activa: true };
    this.enfocar('editar-admin-categoria');
  }

  editarProducto(dato?: ProductoAdmin): void {
    this.categoria = this.variante = null;
    const categoria = this.categorias().find(c => c.activa);
    this.producto = dato ? { ...dato } : {
      id: null, categoria_id: categoria?.id ?? 0, nombre: '', slug: '', descripcion: '',
      precio: 0, precio_anterior: null, activo: true,
    };
    this.enfocar('editar-admin-producto');
  }

  editarVariante(producto: ProductoAdmin, dato?: VarianteAdmin): void {
    this.categoria = this.producto = null;
    this.variante = dato ? { ...dato } : {
      id: null, producto_id: producto.id, nombre: '', sku: '', precio_adicional: 0, activa: true, predeterminada: false,
    };
    this.enfocar('editar-admin-variante');
  }

  guardarCategoria(): Promise<void> {
    const borrador = this.categoria;
    if (!borrador) return Promise.resolve();
    const { id, nombre, slug, descripcion, activa } = borrador;
    if (!nombre.trim() || !this.slugValido(slug)) return this.invalidar('Escribe un nombre y un identificador válido.');
    return this.operar(async () => {
      await this.api.guardarCategoria(id, { nombre: nombre.trim(), slug: slug.trim(), descripcion: descripcion?.trim() || null, activa });
      this.categoria = null;
      await this.catalogoActualizado('Categoría guardada.');
    });
  }

  guardarProducto(): Promise<void> {
    const borrador = this.producto;
    if (!borrador) return Promise.resolve();
    const { id, nombre, slug, descripcion, ...datos } = borrador;
    if (!nombre.trim() || !descripcion.trim() || !this.slugValido(slug) || !datos.categoria_id ||
      !Number.isFinite(datos.precio) || datos.precio < 0 ||
      (datos.precio_anterior !== null && datos.precio_anterior <= datos.precio)) {
      return this.invalidar('Revisa la categoría, el nombre, el identificador, la descripción y los precios.');
    }
    return this.operar(async () => {
      await this.api.guardarProducto(id, { ...datos, nombre: nombre.trim(), slug: slug.trim(), descripcion: descripcion.trim() });
      this.producto = null;
      await this.catalogoActualizado('Producto guardado.');
    });
  }

  guardarVariante(): Promise<void> {
    const borrador = this.variante;
    if (!borrador) return Promise.resolve();
    const { id, nombre, sku, ...datos } = borrador;
    if (!nombre.trim() || !sku.trim() || !Number.isFinite(datos.precio_adicional) || datos.precio_adicional < 0) {
      return this.invalidar('Revisa el nombre, el SKU y el precio adicional.');
    }
    return this.operar(async () => {
      await this.api.guardarVariante(id, { ...datos, nombre: nombre.trim(), sku: sku.trim() });
      this.variante = null;
      await this.catalogoActualizado('Variante guardada. Puedes ajustar sus existencias en Inventario.');
    });
  }

  cambiarVigencia(tabla: 'productos' | 'categorias' | 'variantes_producto' | 'cupones', id: number, activo: boolean): Promise<void> {
    if (!this.confirmar(activo ? '¿Activar este registro?' : '¿Desactivar este registro? Se conserva su historial.')) return Promise.resolve();
    return this.operar(async () => {
      await this.api.cambiarVigencia(tabla, id, activo);
      if (tabla === 'cupones') {
        this.exito.set('Vigencia del cupón actualizada.');
        this.cupones.set(await this.api.cupones());
      } else {
        await this.catalogoActualizado('Vigencia del catálogo actualizada.');
      }
    });
  }

  verInventario(variante: VarianteAdmin): Promise<void> {
    return this.operar(async () => {
      this.varianteAbierta.set(variante);
      this.movimientos.set([]);
      this.delta = this.minimo = null;
      this.motivoStock = '';
      this.movimientos.set(await this.api.movimientos(variante.id));
      this.enfocar('detalle-admin-inventario');
    });
  }

  ajustar(): Promise<void> {
    const variante = this.varianteAbierta();
    const delta = this.delta ?? 0;
    const minimo = this.minimo;
    const motivo = this.motivoStock.trim();
    if (!variante || !motivo || !Number.isInteger(delta) || (!delta && minimo === null) ||
      (minimo !== null && (!Number.isInteger(minimo) || minimo < 0))) {
      return this.invalidar('Indica un ajuste entero o un mínimo válido, y escribe el motivo.');
    }
    if (!this.confirmar('¿Registrar el ajuste de inventario?')) return Promise.resolve();
    return this.operar(async () => {
      await this.api.ajustarStock(variante.id, delta, motivo, minimo);
      this.exito.set('Inventario actualizado.');
      this.delta = this.minimo = null;
      this.motivoStock = '';
      await this.cargarInventario();
    });
  }

  asignarRol(cliente: ClienteAdmin): Promise<void> {
    if (cliente.id === this.usuario()) return Promise.resolve();
    const rol = cliente.rol === 'admin' ? 'cliente' : 'admin';
    if (!this.confirmar('¿Cambiar el rol de ' + cliente.nombre + ' a ' + rol + '?')) return Promise.resolve();
    return this.operar(async () => {
      await this.api.asignarRol(cliente.id, rol);
      this.exito.set('Rol actualizado.');
      this.clientes.set(await this.api.clientes());
    });
  }

  editarCupon(dato?: CuponAdmin): void {
    this.cupon = dato ? { ...dato, inicio: fechaLocal(dato.inicio), fin: fechaLocal(dato.fin) } : {
      id: null, codigo: '', descripcion: '', tipo: 'fijo', valor: 1, inicio: fechaLocal(new Date().toISOString()), fin: '',
      limite_usos: null, activo: true,
    };
    this.enfocar('editar-admin-cupon');
  }

  guardarCupon(): Promise<void> {
    const borrador = this.cupon;
    if (!borrador) return Promise.resolve();
    const { id, descripcion, codigo, inicio, fin, ...datos } = borrador;
    const desde = new Date(inicio);
    const hasta = fin ? new Date(fin) : null;
    const clave = codigo.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(clave) || !Number.isFinite(datos.valor) || datos.valor <= 0 ||
      (datos.tipo === 'porcentaje' && datos.valor > 100) || !Number.isFinite(desde.getTime()) ||
      (hasta && !(hasta.getTime() > desde.getTime())) ||
      (datos.limite_usos !== null && (!Number.isInteger(datos.limite_usos) || datos.limite_usos < 1))) {
      return this.invalidar('Revisa el código, el valor, las fechas y el límite de usos del cupón.');
    }
    return this.operar(async () => {
      await this.api.guardarCupon(id, {
        ...datos, codigo: clave, descripcion: descripcion?.trim() || null, inicio: desde.toISOString(), fin: hasta?.toISOString() ?? null,
      });
      this.cupon = null;
      this.exito.set('Cupón guardado.');
      this.cupones.set(await this.api.cupones());
    });
  }

  editarDevolucion(dato: DevolucionAdmin): void {
    this.devolucion = dato;
    this.estadoDevolucion = this.resolucion = '';
    this.reponer = false;
    this.enfocar('detalle-admin-devolucion');
  }

  resolver(): Promise<void> {
    const solicitud = this.devolucion;
    const estado = this.estadoDevolucion;
    const resolucion = this.resolucion.trim();
    if (!solicitud || !estado || !resolucion || !this.confirmar('¿Registrar esta resolución de devolución?')) return Promise.resolve();
    return this.operar(async () => {
      await this.api.resolverDevolucion(solicitud.id, estado, resolucion, estado === 'recibida' && this.reponer);
      this.exito.set('Devolución actualizada.');
      this.devolucion = null;
      this.devoluciones.set(await this.api.devoluciones());
    });
  }

  private async cargarCatalogo(): Promise<void> {
    const [categorias, productos, variantes] = await Promise.all([this.api.categorias(), this.api.productos(), this.api.variantes()]);
    this.categorias.set(categorias);
    this.productos.set(productos);
    this.variantes.set(variantes);
  }

  private async catalogoActualizado(mensaje: string): Promise<void> {
    this.exito.set(mensaje);
    await Promise.all([this.cargarCatalogo(), this.catalogo.cargar(true)]);
  }

  private async cargarInventario(): Promise<void> {
    const [productos, variantes, existencias] = await Promise.all([this.api.productos(), this.api.variantes(), this.api.existencias()]);
    this.productos.set(productos);
    this.variantes.set(variantes);
    this.existencias.set(existencias);
    const variante = this.varianteAbierta();
    if (variante) this.movimientos.set(await this.api.movimientos(variante.id));
  }

  private async cargarResumen(): Promise<void> {
    const [pedidos, pagos, productos, existencias, partidas, devoluciones, variantes] = await Promise.all([
      this.api.pedidos(), this.api.pagos(), this.api.productos(), this.api.existencias(), this.api.partidas(),
      this.api.devoluciones(), this.api.variantes(),
    ]);
    const porVariante = new Map(existencias.map(e => [e.variante_id, e]));
    this.indicadores.set({
      pedidos: pedidos.length, productos: productos.filter(p => p.activo).length,
      productosPrueba: productos.filter(p => p.activo && this.origenPrueba(p)).length,
      existencias: existencias.reduce((total, e) => total + e.cantidad, 0),
      stockBajo: variantes.filter(v => v.activa && this.stockBajo(porVariante.get(v.id))).length,
      ventas: pagos.reduce((total, p) => total + (p.estado === 'reembolsado' ? -p.monto : p.monto), 0),
      devoluciones: devoluciones.length,
    });
    const vigentes = new Set(pedidos.filter(p => p.estado !== 'cancelado').map(p => p.id));
    const totales = new Map<string, number>();
    for (const partida of partidas) {
      if (vigentes.has(partida.pedido_id)) {
        totales.set(partida.nombre_producto, (totales.get(partida.nombre_producto) ?? 0) + partida.cantidad);
      }
    }
    this.masVendidos.set([...totales].map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad).slice(0, 5));
  }

  private async operar(accion: () => Promise<void>): Promise<void> {
    if (this.ocupado() || !this.api.esAdmin()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.exito.set('');
    try {
      if (!await this.api.comprobarRol()) throw new Error('ADMIN_REQUERIDO');
      await accion();
    } catch (error) {
      this.error.set(this.exito() ? 'El cambio se guardó. Actualiza la vista para consultar los datos nuevos.' : mensajeAdmin(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  private invalidar(mensaje: string): Promise<void> {
    this.exito.set('');
    this.error.set(mensaje);
    return Promise.resolve();
  }

  private confirmar(texto: string): boolean { return this.documento.defaultView?.confirm(texto) === true; }
  private slugValido(slug: string): boolean { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim()); }

  private enfocar(id: string): void {
    afterNextRender({ write: () => this.documento.getElementById(id)?.focus() }, { injector: this.injector });
  }
}
