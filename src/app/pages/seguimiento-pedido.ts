import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Autenticacion } from '../services/autenticacion';
import { mensajePedido, PartidaSolicitada, PedidoEnSeguimiento, Pedidos } from '../services/pedidos';
import { estadoSeguimiento, pasosEntrega, solicitudCoincide, unidadesPorPartida } from './seguimiento-reglas';

@Component({
  selector: 'app-seguimiento-pedido',
  imports: [DatePipe, TitleCasePipe, FormsModule],
  templateUrl: './seguimiento-pedido.html',
  styleUrl: './seguimiento-pedido.css',
})
export class SeguimientoPedido {
  readonly pedido = input.required<PedidoEnSeguimiento>();
  readonly pedidoActualizado = output<PedidoEnSeguimiento>();
  private readonly pedidos = inject(Pedidos);
  private readonly auth = inject(Autenticacion);
  private readonly vida = inject(DestroyRef);
  private readonly actualizado = signal<PedidoEnSeguimiento | null>(null);
  readonly datos = computed(() => this.actualizado() ?? this.pedido());
  readonly estado = computed(() => estadoSeguimiento(this.datos()));
  readonly pasos = pasosEntrega;
  readonly indicePaso = computed(() => pasosEntrega.findIndex(paso => paso.estado === this.estado()));
  readonly partidasPorId = computed(() => new Map(this.datos().detalle_pedido.map(p => [p.id, p])));
  readonly disponibles = computed(() => {
    const pedido = this.datos();
    if (pedido.estado !== 'entregado' || !pedido.cliente?.activo) return [];
    const ocupadas = unidadesPorPartida(pedido);
    return pedido.detalle_pedido.map(p => ({ ...p, maximo: p.cantidad - (ocupadas.get(p.id) ?? 0) }))
      .filter(p => p.maximo > 0);
  });
  readonly ocupado = signal(false);
  readonly requiereRevision = signal(false);
  readonly abierto = signal(false);
  readonly exito = signal('');
  readonly error = signal('');
  cantidades: Record<number, number | null> = {};
  motivo = '';

  async actualizar(): Promise<void> {
    await this.conPedido(async (usuario, pedido, vigente) => {
      const actual = await this.consultar(usuario, pedido);
      if (!vigente()) return;
      this.mostrar(actual);
      this.requiereRevision.set(false);
    });
  }

  async enviar(): Promise<void> {
    if (!this.abierto() || this.requiereRevision() || this.ocupado()) return;
    const motivo = this.motivo.trim();
    const partidas: PartidaSolicitada[] = this.disponibles().flatMap(p => {
      const cantidad = this.cantidades[p.id] ?? 0;
      return cantidad === 0 ? [] : [{ id: p.id, cantidad }];
    });
    if (!motivo || motivo.length > 1000 || !partidas.length ||
      partidas.some(p => !Number.isInteger(p.cantidad) || p.cantidad < 1)) {
      this.error.set('Selecciona al menos una cantidad entera y escribe el motivo de la devolución.');
      return;
    }

    await this.conPedido(async (usuario, pedido, vigente) => {
      this.exito.set('');
      const actual = await this.consultar(usuario, pedido);
      if (!vigente()) return;
      this.mostrar(actual);
      const existente = actual.solicitudes_devolucion.find(s => solicitudCoincide(s, partidas, motivo));
      if (existente) {
        this.completar('La solicitud #' + existente.id + ' ya está registrada.');
        return;
      }
      const disponibles = new Map(this.disponibles().map(p => [p.id, p.maximo]));
      if (partidas.some(p => p.cantidad > (disponibles.get(p.id) ?? 0))) {
        this.error.set('Las unidades disponibles cambiaron. Revisa las cantidades antes de enviar.');
        this.cantidades = {};
        return;
      }
      let id: number;
      try {
        id = await this.pedidos.solicitarDevolucion(usuario, actual.id, partidas, motivo);
      } catch (error) {
        if (vigente()) {
          this.requiereRevision.set(true);
          this.error.set(mensajePedido(error,
            'No pudimos confirmar el resultado. Actualiza el seguimiento antes de volver a enviar.'));
        }
        return;
      }
      if (!vigente()) return;
      this.completar('Solicitud #' + id + ' registrada. El equipo revisará tu devolución.');
      this.requiereRevision.set(true);
      try {
        const actualizado = await this.consultar(usuario, pedido);
        if (!vigente()) return;
        this.mostrar(actualizado);
        this.requiereRevision.set(false);
      } catch {
        if (vigente()) this.error.set('La solicitud se registró. Actualiza el seguimiento para ver su estado.');
      }
    });
  }

  private completar(mensaje: string): void {
    this.exito.set(mensaje);
    this.abierto.set(false);
    this.cantidades = {};
    this.motivo = '';
  }

  private mostrar(pedido: PedidoEnSeguimiento): void {
    this.actualizado.set(pedido);
    this.pedidoActualizado.emit(pedido);
  }

  private async consultar(usuario: string, pedido: PedidoEnSeguimiento): Promise<PedidoEnSeguimiento> {
    const actual = await this.pedidos.obtener(usuario, pedido.folio);
    if (!actual) throw new Error('PEDIDO_INEXISTENTE');
    return actual;
  }

  private async conPedido(
    accion: (usuario: string, pedido: PedidoEnSeguimiento, vigente: () => boolean) => Promise<void>,
  ): Promise<void> {
    const usuario = this.auth.sesion()?.user.id;
    const pedido = this.pedido();
    if (!usuario || this.ocupado()) return;
    const vigente = () => !this.vida.destroyed && this.pedido().id === pedido.id &&
      this.auth.sesion()?.user.id === usuario;
    this.ocupado.set(true);
    this.error.set('');
    try {
      await accion(usuario, pedido, vigente);
    } catch (error) {
      if (vigente()) this.error.set(mensajePedido(error, 'No pudimos actualizar el seguimiento.'));
    } finally {
      if (vigente()) this.ocupado.set(false);
    }
  }
}
