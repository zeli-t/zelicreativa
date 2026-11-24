import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, PendingTasks } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Autenticacion } from '../../services/autenticacion';
import { mensajePedido, PedidoEnSeguimiento, Pedidos } from '../../services/pedidos';
import { estadoSeguimiento } from '../seguimiento-reglas';

@Component({
  selector: 'app-confirmacion-pedido',
  standalone: false,
  templateUrl: './confirmacion-pedido.html',
  styleUrl: './confirmacion-pedido.css',
})
export class ConfirmacionPedido {
  private readonly auth = inject(Autenticacion);
  private readonly pedidos = inject(Pedidos);
  private readonly tareas = inject(PendingTasks);
  private readonly documento = inject(DOCUMENT);
  private readonly vida = inject(DestroyRef);
  private readonly parametros = toSignal(inject(ActivatedRoute).queryParamMap);
  private readonly folio = computed(() => this.parametros()?.get('folio') ?? '');
  private readonly usuario = computed(() => this.auth.sesion()?.user.id);
  private readonly reintento = signal(0);
  readonly pedido = signal<PedidoEnSeguimiento | null>(null);
  readonly estadoSeguimiento = estadoSeguimiento;
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly descargando = signal(false);
  readonly errorDescarga = signal('');

  constructor() {
    effect(limpiar => {
      this.reintento();
      const usuario = this.usuario();
      const folio = this.folio();
      this.pedido.set(null);
      this.cargando.set(false);
      this.error.set('');
      this.errorDescarga.set('');
      if (!usuario) {
        this.error.set('Inicia sesión para consultar tu pedido.');
        return;
      }
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(folio)) {
        this.error.set('No se encontró un folio de pedido válido.');
        return;
      }
      if (!this.pedidos.habilitado) {
        this.error.set('Abre el entorno de pruebas para consultar la compra simulada.');
        return;
      }
      let vigente = true;
      limpiar(() => { vigente = false; });
      this.cargando.set(true);
      this.tareas.run(async () => {
        try {
          const pedido = await this.pedidos.obtener(usuario, folio);
          if (!vigente || this.usuario() !== usuario) return;
          this.pedido.set(pedido);
          if (!pedido) this.error.set('No encontramos ese pedido en tu cuenta.');
        } catch (error) {
          if (vigente) this.error.set(mensajePedido(error, 'No pudimos consultar el pedido. Inténtalo de nuevo.'));
        } finally {
          if (vigente) this.cargando.set(false);
        }
      });
    });
  }

  intentarDeNuevo(): void {
    this.reintento.update(n => n + 1);
  }

  async descargar(): Promise<void> {
    const pedido = this.pedido();
    const usuario = this.usuario();
    if (!pedido || !usuario || this.descargando()) return;
    const vigente = () => !this.vida.destroyed && this.usuario() === usuario &&
      this.folio() === pedido.folio && this.pedido() === pedido;
    this.errorDescarga.set('');
    this.descargando.set(true);
    try {
      const [{ generarComprobante }, respuesta] = await Promise.all([
        import('./comprobante-pdf'),
        fetch(new URL('zc.png', this.documento.baseURI), { signal: AbortSignal.timeout(10000) }),
      ]);
      if (!respuesta.ok) throw new Error('LOGO_NO_DISPONIBLE');
      if (!vigente()) return;
      const pdf = await generarComprobante(pedido, await respuesta.arrayBuffer());
      if (!vigente()) return;
      const archivo = new Blob([Uint8Array.from(pdf).buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(archivo);
      const enlace = this.documento.createElement('a');
      enlace.href = url;
      enlace.download = 'Zeli-Creativa-' + pedido.folio + '.pdf';
      this.documento.body.appendChild(enlace);
      try {
        enlace.click();
      } finally {
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      if (vigente()) this.errorDescarga.set('No pudimos generar el PDF. Vuelve a intentar la descarga.');
    } finally {
      this.descargando.set(false);
    }
  }
}
