import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Autenticacion } from '../services/autenticacion';
import { PedidoEnSeguimiento, Pedidos, SolicitudDevolucion } from '../services/pedidos';
import { SeguimientoPedido } from './seguimiento-pedido';
import { estadoSeguimiento } from './seguimiento-reglas';

describe('Seguimiento y devoluciones', () => {
  const pedido: PedidoEnSeguimiento = {
    id: 8, folio: 'folio-ficticio', estado: 'entregado', cliente: { nombre: 'Itzel', activo: true },
    creado_en: '2026-11-22T12:00:00Z', total: 166, subtotal: 100, iva: 16, envio: 50, descuento: 0,
    envios: { numero_guia: 'DEMO-123', estado: 'entregado', empresa: { nombre: 'Paquetería demo' } },
    historial_estados_pedido: [{ id: 1, estado_nuevo: 'preparando', motivo: 'Preparación para demo', creado_en: '2026-11-22T12:00:00Z' }],
    detalle_pedido: [{ id: 19, nombre_producto: 'Libreta', nombre_variante: 'Rosa', sku: 'LIB-001', cantidad: 2,
      precio_unitario: 50, subtotal: 100 }],
    solicitudes_devolucion: [],
  };
  const solicitud: SolicitudDevolucion = {
    id: 5, estado: 'solicitada', motivo: 'Llegó dañada', resolucion: null, creado_en: pedido.creado_en,
    resuelto_en: null, detalle_devolucion: [{ detalle_pedido_id: 19, cantidad: 1 }],
  };
  const obtener = vi.fn<() => Promise<PedidoEnSeguimiento>>();
  const solicitar = vi.fn<() => Promise<number>>();

  beforeEach(() => {
    obtener.mockReset();
    solicitar.mockReset();
    TestBed.configureTestingModule({
      imports: [SeguimientoPedido],
      providers: [
        { provide: Autenticacion, useValue: { sesion: signal({ user: { id: 'cliente-demo' } }) } },
        { provide: Pedidos, useValue: { obtener, solicitarDevolucion: solicitar } },
      ],
    });
  });

  function abrir(datos = pedido) {
    const fixture = TestBed.createComponent(SeguimientoPedido);
    fixture.componentRef.setInput('pedido', datos);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra guía e historial, y oculta el progreso para Cancelado y Devuelto', () => {
    const fixture = abrir({ ...pedido, estado: 'enviado' });
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[aria-current="step"]')?.textContent).toContain('Enviado');
    expect(html.textContent).toContain('DEMO-123');
    expect(html.textContent).toContain('Preparación para demo');
    expect(html.textContent).not.toContain('Solicitar devolución');
    fixture.componentRef.setInput('pedido', { ...pedido, estado: 'cancelado' });
    fixture.detectChanges();
    expect(html.querySelector('.pasos-entrega')).toBeNull();
    expect(html.textContent).toContain('Cancelado');
    const devuelto = { ...pedido, solicitudes_devolucion: [
      { ...solicitud, estado: 'recibida' },
      { ...solicitud, id: 6, estado: 'recibida' },
    ] };
    fixture.componentRef.setInput('pedido', devuelto);
    fixture.detectChanges();
    expect(estadoSeguimiento(devuelto)).toBe('devuelto');
    expect(html.querySelector('.pasos-entrega')).toBeNull();
    expect(html.textContent).toContain('Devuelto');
  });

  it('registra solo una solicitud y actualiza las unidades que quedan disponibles', async () => {
    const fixture = abrir();
    const vista = fixture.componentInstance;
    obtener.mockResolvedValueOnce(pedido).mockResolvedValueOnce({ ...pedido, solicitudes_devolucion: [solicitud] });
    solicitar.mockResolvedValueOnce(5);
    vista.abierto.set(true);
    vista.motivo = solicitud.motivo;
    vista.cantidades[19] = 1;
    await Promise.all([vista.enviar(), vista.enviar()]);
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('cliente-demo', 8, [{ id: 19, cantidad: 1 }], solicitud.motivo);
    expect(vista.exito()).toContain('#5');
    expect(vista.disponibles()[0].maximo).toBe(1);
  });

  it('reconoce la solicitud existente antes de repetir un envío', async () => {
    const vista = abrir().componentInstance;
    obtener.mockResolvedValueOnce({ ...pedido, solicitudes_devolucion: [solicitud] });
    vista.abierto.set(true);
    vista.motivo = solicitud.motivo;
    vista.cantidades[19] = 1;
    await vista.enviar();
    expect(solicitar).not.toHaveBeenCalled();
    expect(vista.exito()).toContain('ya está registrada');
  });
});
