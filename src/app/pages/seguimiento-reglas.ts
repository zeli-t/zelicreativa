import type { PartidaSolicitada, PedidoEnListaCliente, SolicitudDevolucion } from '../services/pedidos';

type PartidasPedido = Pick<PedidoEnListaCliente, 'detalle_pedido' | 'solicitudes_devolucion'>;

export const pasosEntrega = [
  { estado: 'pagado', texto: 'Pagado' },
  { estado: 'preparando', texto: 'Preparando' },
  { estado: 'enviado', texto: 'Enviado' },
  { estado: 'entregado', texto: 'Entregado' },
] as const;

export function unidadesPorPartida(pedido: PartidasPedido, soloRecibidas = false): Map<number, number> {
  const cantidades = new Map<number, number>();
  for (const solicitud of pedido.solicitudes_devolucion) {
    if (soloRecibidas ? solicitud.estado !== 'recibida' : solicitud.estado === 'rechazada') continue;
    for (const partida of solicitud.detalle_devolucion) {
      cantidades.set(partida.detalle_pedido_id, (cantidades.get(partida.detalle_pedido_id) ?? 0) + partida.cantidad);
    }
  }
  return cantidades;
}

export function estadoSeguimiento(pedido: Pick<PedidoEnListaCliente, 'estado'> & PartidasPedido): string {
  if (pedido.estado !== 'entregado') return pedido.estado;
  const recibidas = unidadesPorPartida(pedido, true);
  return pedido.detalle_pedido.length && pedido.detalle_pedido.every(p => (recibidas.get(p.id) ?? 0) >= p.cantidad)
    ? 'devuelto' : pedido.estado;
}

export function solicitudCoincide(solicitud: SolicitudDevolucion, partidas: PartidaSolicitada[], motivo: string): boolean {
  return solicitud.estado !== 'rechazada' && solicitud.motivo.trim() === motivo &&
    solicitud.detalle_devolucion.length === partidas.length && partidas.every(partida =>
      solicitud.detalle_devolucion.some(recibida =>
        recibida.detalle_pedido_id === partida.id && recibida.cantidad === partida.cantidad),
    );
}
