import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Autenticacion } from '../../services/autenticacion';
import { Carrito } from '../../services/carrito';
import { CAMPOS_DIRECCION, campoDireccionValido, DatosDireccion, Direccion, Direcciones, direccionVacia } from '../../services/direcciones';
import { Compra, Cotizacion, mensajePedido, PedidoRegistrado, Pedidos, VERSION_TERMINOS_COMPRA } from '../../services/pedidos';

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  readonly auth = inject(Autenticacion);
  readonly carrito = inject(Carrito);
  readonly pedidos = inject(Pedidos);
  private readonly router = inject(Router);
  private readonly vida = inject(DestroyRef);
  private readonly vista = inject(ChangeDetectorRef);
  private readonly direccionesApi = inject(Direcciones);
  private readonly usuarioId = computed(() => this.auth.sesion()?.user.id);
  private readonly partidas = toSignal(this.carrito.carrito$, { requireSync: true });
  readonly direcciones = signal<Direccion[]>([]);
  readonly cargandoDirecciones = signal(false);
  readonly guardandoDireccion = signal(false);
  readonly errorDirecciones = signal('');
  readonly errorGuardado = signal('');
  readonly avisoDireccion = signal('');
  direccionId: number | null = null;
  direccion = direccionVacia();
  telefonoEntrega = '';
  telefonoRevisado = false;
  paso = 1;
  enviado = false;
  cupon = '';
  aceptaTerminos = false;
  enviando = false;
  errorCompra = '';
  cotizacion: Cotizacion | null = null;
  private revision: { compra: Compra; huella: string; clave: string } | null = null;

  readonly camposDireccion = CAMPOS_DIRECCION;

  constructor() {
    effect(() => {
      const usuario = this.usuarioId();
      this.direcciones.set([]);
      this.direccionId = null;
      this.direccion = direccionVacia();
      this.telefonoEntrega = '';
      this.telefonoRevisado = false;
      this.cupon = '';
      this.regresarPaso(true);
      this.revision = null;
      this.paso = 1;
      this.enviado = false;
      this.guardandoDireccion.set(false);
      this.cargandoDirecciones.set(false);
      this.errorDirecciones.set('');
      this.errorGuardado.set('');
      this.avisoDireccion.set('');
      if (usuario) untracked(() => void this.cargarDirecciones());
    });
  }

  get subtotal(): number {
    this.partidas();
    return this.carrito.obtenerSubtotal();
  }

  get impuestos(): number { return this.subtotal * 0.16; }
  get envio(): number { return /^88\d{3}$/.test(this.direccion.codigo_postal) ? 50 : 60; }
  get total(): number { return this.subtotal + this.impuestos + this.envio; }
  get plazoEntrega(): string {
    return /^88\d{3}$/.test(this.direccion.codigo_postal) ? '2 a 3 días hábiles' : '3 a 5 días hábiles';
  }
  readonly productos = this.partidas;

  get telefonoEntregaNormalizado(): string | null {
    const compacto = this.telefonoEntrega.replace(/[ \t().-]/g, '');
    const nacional = compacto.startsWith('+52') ? compacto.slice(3) : compacto;
    return nacional.length === 10 && !/[^0-9]/.test(nacional) ? '+52' + nacional : null;
  }

  async cargarDirecciones(): Promise<void> {
    const usuario = this.usuarioId();
    if (!usuario || this.cargandoDirecciones()) return;
    this.errorDirecciones.set('');
    this.cargandoDirecciones.set(true);
    try {
      const filas = await this.direccionesApi.listar(usuario);
      if (this.usuarioId() === usuario) this.direcciones.set(filas);
    } catch {
      if (this.usuarioId() === usuario) this.errorDirecciones.set('No pudimos cargar tus direcciones.');
    } finally {
      if (this.usuarioId() === usuario) this.cargandoDirecciones.set(false);
    }
  }

  elegirDireccion(id: number | null): void {
    const guardada = this.direcciones().find(d => d.id === id);
    this.direccionId = guardada?.id ?? null;
    this.direccion = guardada ? { ...guardada } : direccionVacia();
    this.enviado = false;
    this.errorGuardado.set('');
    this.avisoDireccion.set('');
  }

  campoValido(id: keyof DatosDireccion): boolean {
    return campoDireccionValido(this.direccion, id);
  }

  async guardarDireccion(): Promise<void> {
    const usuario = this.usuarioId();
    if (!usuario || this.guardandoDireccion() || this.direccionId !== null) return;
    this.enviado = true;
    this.errorGuardado.set('');
    this.avisoDireccion.set('');
    if (!this.camposDireccion.every(campo => this.campoValido(campo.id))) return;

    const datos = Object.fromEntries(this.camposDireccion.map(campo => [
      campo.id, this.direccion[campo.id].trim(),
    ])) as unknown as DatosDireccion;
    this.guardandoDireccion.set(true);
    try {
      const guardada = await this.direccionesApi.guardar(usuario, datos);
      if (this.usuarioId() !== usuario) return;
      this.direcciones.update(filas => [guardada, ...filas.filter(f => f.id !== guardada.id)]);
      this.elegirDireccion(guardada.id);
      this.avisoDireccion.set('Dirección guardada.');
    } catch {
      if (this.usuarioId() === usuario) this.errorGuardado.set('No pudimos guardar la dirección. Intenta de nuevo.');
    } finally {
      if (this.usuarioId() === usuario) this.guardandoDireccion.set(false);
    }
  }

  async siguientePaso(): Promise<void> {
    const usuario = this.usuarioId();
    if (!usuario || this.guardandoDireccion() || this.enviando || !this.pedidos.habilitado) return;
    this.errorCompra = '';
    if (!this.carrito.puedeContinuar()) {
      this.errorCompra = 'Revisa el carrito. Cada partida debe tener una variante válida.';
      return;
    }
    this.enviado = true;
    this.telefonoRevisado = true;
    if (!this.camposDireccion.every(campo => this.campoValido(campo.id)) || !this.telefonoEntregaNormalizado) return;
    if (this.direccionId === null) {
      this.errorCompra = 'Guarda la dirección nueva antes de revisar la compra.';
      return;
    }
    const compra = this.compraActual();
    if (!compra) return;
    this.enviando = true;
    try {
      const intento = await this.pedidos.identificarIntento(usuario, compra);
      if (!this.sigueActivo(usuario)) return;
      this.revision = { compra, ...intento };
      const respuesta = await this.pedidos.registrar(usuario, compra, intento.clave);
      if (!this.sigueActivo(usuario)) return;
      if ('folio' in respuesta) {
        this.finalizar(respuesta, intento.huella, compra);
        return;
      }
      if (!this.coincide(compra)) {
        this.errorCompra = 'Los datos de la compra cambiaron. Vuelve a revisar el pedido.';
        return;
      }
      this.cotizacion = respuesta;
      this.aceptaTerminos = false;
      this.paso = 2;
      this.enviado = false;
    } catch (error) {
      if (this.sigueActivo(usuario)) this.errorCompra = mensajePedido(error, 'No pudimos obtener la cotización. Tu carrito se conserva.');
    } finally {
      if (this.sigueActivo(usuario)) {
        this.enviando = false;
        this.vista.markForCheck();
      }
    }
  }

  async confirmarPago(): Promise<void> {
    const usuario = this.usuarioId();
    const revision = this.revision;
    if (!usuario || !revision || !this.cotizacion || !this.aceptaTerminos || this.enviando || !this.pedidos.habilitado) return;
    this.errorCompra = '';
    if (!this.coincide(revision.compra) || !this.carrito.puedeContinuar()) {
      this.regresarPaso();
      this.errorCompra = 'El carrito o los datos de entrega cambiaron. Vuelve a revisar el pedido.';
      return;
    }
    this.enviando = true;
    try {
      const respuesta = await this.pedidos.registrar(usuario, revision.compra, revision.clave, this.cotizacion.total);
      if (!this.sigueActivo(usuario)) return;
      if ('folio' in respuesta) {
        this.finalizar(respuesta, revision.huella, revision.compra);
      } else {
        this.cotizacion = respuesta;
        this.aceptaTerminos = false;
        this.errorCompra = 'El total cambió. Revisa el nuevo importe antes de confirmar.';
      }
    } catch (error) {
      if (this.sigueActivo(usuario)) this.errorCompra = mensajePedido(error, 'No pudimos confirmar la compra. Reintenta desde aquí. Tu carrito se conserva.');
    } finally {
      if (this.sigueActivo(usuario)) {
        this.enviando = false;
        this.vista.markForCheck();
      }
    }
  }

  private sigueActivo(usuario: string): boolean {
    return !this.vida.destroyed && this.usuarioId() === usuario;
  }

  private compraActual(): Compra | null {
    const telefono = this.telefonoEntregaNormalizado;
    if (this.direccionId === null || !telefono) return null;
    const partidas = this.partidas();
    if (!partidas.length || partidas.some(p => p.varianteId === undefined)) return null;
    return {
      p_items: partidas.flatMap(p => p.varianteId === undefined ? [] : [{ id: p.varianteId, cantidad: p.cantidad }])
        .sort((a, b) => a.id - b.id),
      p_direccion: this.direccionId,
      p_telefono_entrega: telefono,
      p_cupon: this.cupon.trim().toUpperCase() || null,
      p_terminos_version: VERSION_TERMINOS_COMPRA,
    };
  }

  private coincide(compra: Compra): boolean {
    return JSON.stringify(this.compraActual()) === JSON.stringify(compra);
  }

  private finalizar(pedido: PedidoRegistrado, huella: string, compra: Compra): void {
    this.revision = null;
    this.aceptaTerminos = false;
    if (this.coincide(compra)) this.carrito.vaciarCarrito();
    this.pedidos.cerrarIntento(huella);
    void this.router.navigate(['/confirmacion-pedido'], { queryParams: { folio: pedido.folio } });
  }

  regresarPaso(reiniciar = false): void {
    if (this.enviando && !reiniciar) return;
    this.enviando = false;
    this.paso = 1;
    this.cotizacion = null;
    this.aceptaTerminos = false;
    this.errorCompra = '';
  }
}
