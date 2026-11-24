import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, RouterModule } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { Autenticacion } from '../../services/autenticacion';
import { Pedidos } from '../../services/pedidos';
import { SeguimientoPedido } from '../seguimiento-pedido';
import { ConfirmacionPedido } from './confirmacion-pedido';

describe('ConfirmacionPedido', () => {
  let fixture: ComponentFixture<ConfirmacionPedido>;
  const folio = 'b7560ca0-d34e-4ac1-8fec-e89c07bbc100';
  const parametros = new BehaviorSubject(convertToParamMap({ folio }));
  const obtener = vi.fn(async () => ({
    id: 8, folio, estado: 'pagado', total: 166, subtotal: 100, iva: 16, envio: 50, descuento: 0,
    creado_en: '2026-11-22T12:00:00Z', cliente: { nombre: 'Itzel', activo: true },
    envios: null, solicitudes_devolucion: [], historial_estados_pedido: [],
    detalle_pedido: [{ id: 1, nombre_producto: 'Libreta', nombre_variante: 'Rosa', sku: 'LIB-001',
      cantidad: 1, precio_unitario: 100, subtotal: 100 }],
  }));

  beforeEach(async () => {
    parametros.next(convertToParamMap({ folio }));
    obtener.mockClear();
    await TestBed.configureTestingModule({
      declarations: [ConfirmacionPedido],
      imports: [CommonModule, RouterModule, SeguimientoPedido],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: parametros } },
        { provide: Autenticacion, useValue: { sesion: signal({ user: { id: 'cliente-a' } }) } },
        { provide: Pedidos, useValue: { habilitado: true, obtener } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacionPedido);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('muestra el folio y el detalle persistidos para el cliente autenticado', () => {
    expect(obtener).toHaveBeenCalledWith('cliente-a', folio);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.numero-pedido strong')?.textContent).toContain(folio);
    expect(html.textContent).toContain('Libreta');
    expect(html.textContent).toContain('166.00');
    expect(html.textContent).toContain('Descargar comprobante PDF');
  });

  it('descarta un folio inválido y limpia el pedido anterior', async () => {
    parametros.next(convertToParamMap({ folio: 'incorrecto' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(obtener).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.pedido()).toBeNull();
    expect(fixture.componentInstance.error()).toContain('folio');
  });
});
