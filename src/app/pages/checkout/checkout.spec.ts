import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { Autenticacion } from '../../services/autenticacion';
import { Carrito } from '../../services/carrito';
import { Direcciones } from '../../services/direcciones';
import { Cotizacion, PedidoRegistrado, Pedidos } from '../../services/pedidos';
import { Checkout } from './checkout';

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  const sesion = signal({ user: { id: 'cliente-a' } });
  const direccion = {
    id: 7, destinatario: 'Persona de prueba', calle: 'Calle de prueba', numero: '30',
    colonia: 'Centro', ciudad: 'Ciudad de prueba', estado: 'Estado de prueba', codigo_postal: '88010',
  };
  const listar = vi.fn(async () => [direccion]);
  const guardar = vi.fn(async () => direccion);
  const cotizacion: Cotizacion = {
    estado: 'requiere_confirmacion', subtotal: 100, iva: 16, envio: 50, descuento: 0, total: 166,
  };
  const registrar = vi.fn<(...args: unknown[]) => Promise<Cotizacion | PedidoRegistrado>>();
  const vaciarCarrito = vi.fn();
  const cerrarIntento = vi.fn();

  beforeEach(async () => {
    listar.mockClear();
    guardar.mockClear();
    registrar.mockReset().mockResolvedValue(cotizacion);
    vaciarCarrito.mockClear();
    cerrarIntento.mockClear();
    sesion.set({ user: { id: 'cliente-a' } });
    await TestBed.configureTestingModule({
      declarations: [Checkout],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [
        provideRouter([]),
        { provide: Autenticacion, useValue: { sesion } },
        { provide: Carrito, useValue: {
          carrito$: new BehaviorSubject([{ clave: 'variante-3', varianteId: 3, nombre: 'Libreta', cantidad: 1 }]),
          obtenerSubtotal: () => 100,
          puedeContinuar: () => true,
          vaciarCarrito,
        } },
        { provide: Direcciones, useValue: { listar, guardar } },
        { provide: Pedidos, useValue: {
          habilitado: true, registrar, cerrarIntento,
          identificarIntento: async () => ({ huella: 'huella', clave: 'clave-estable' }),
        } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(listar).toHaveBeenCalledWith('cliente-a');
  });

  it('valida los campos y guarda solo mediante una acción explícita', async () => {
    const componente = fixture.componentInstance;
    await componente.guardarDireccion();
    expect(guardar).not.toHaveBeenCalled();
    componente.direccion = { ...direccion, codigo_postal: '123' };
    componente.siguientePaso();
    expect(componente.paso).toBe(1);
    componente.direccion.codigo_postal = '88010';
    await componente.guardarDireccion();
    expect(guardar).toHaveBeenCalledWith('cliente-a', {
      destinatario: direccion.destinatario, calle: direccion.calle, numero: direccion.numero,
      colonia: direccion.colonia, ciudad: direccion.ciudad, estado: direccion.estado, codigo_postal: '88010',
    });
    expect(componente.direccionId).toBe(7);
    expect(componente.telefonoEntrega).toBe('');
    expect(componente.paso).toBe(1);
  });

  it('muestra el total cotizado sin campos bancarios y exige aceptar los términos', async () => {
    const componente = fixture.componentInstance;
    componente.elegirDireccion(7);
    componente.telefonoEntrega = '+52 (868) 123-45.67';
    await componente.siguientePaso();
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('166.00');
    expect(html.textContent).toContain('Confirmar pago simulado');
    expect(html.textContent).toContain('Teléfono de entrega: +528681234567');
    expect(html.textContent).not.toMatch(/CVV|Número de tarjeta|Confirmar y pagar/i);
    expect(componente.envio).toBe(50);
    expect(guardar).not.toHaveBeenCalled();
    await componente.confirmarPago();
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('bloquea la revisión con un teléfono ausente o inválido', () => {
    const componente = fixture.componentInstance;
    componente.elegirDireccion(7);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector<HTMLInputElement>('#checkout-telefono')?.required).toBe(true);
    for (const telefono of ['', '() .-', '868123456', '528681234567', '+1 8681234567', '8681234567 ext 1', '8681234567\n']) {
      componente.telefonoEntrega = telefono;
      componente.siguientePaso();
      fixture.detectChanges();
      expect(componente.paso).toBe(1);
      expect(html.querySelector('#checkout-telefono')?.getAttribute('aria-invalid')).toBe('true');
    }
  });

  it('conserva el teléfono al cambiar de dirección y lo limpia al cambiar de cuenta', async () => {
    const componente = fixture.componentInstance;
    componente.telefonoEntrega = '868 123 4567';
    componente.elegirDireccion(7);
    componente.elegirDireccion(null);
    componente.direccion = { ...direccion };
    await componente.guardarDireccion();
    await componente.siguientePaso();
    expect(componente.paso).toBe(2);
    expect(componente.telefonoEntregaNormalizado).toBe('+528681234567');
    sesion.set({ user: { id: 'cliente-b' } });
    fixture.detectChanges();
    expect(componente.telefonoEntrega).toBe('');
    expect(componente.telefonoRevisado).toBe(false);
    expect(componente.paso).toBe(1);
    expect(listar).toHaveBeenCalledWith('cliente-b');
  });

  it('conserva el carrito tras perder la conexión y reintenta con la misma clave', async () => {
    const componente = fixture.componentInstance;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    componente.elegirDireccion(7);
    componente.telefonoEntrega = '8681234567';
    await componente.siguientePaso();
    componente.aceptaTerminos = true;
    registrar.mockRejectedValueOnce(new Error('CONEXION'));
    await Promise.all([componente.confirmarPago(), componente.confirmarPago()]);
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(componente.errorCompra).toContain('Reintenta');
    expect(vaciarCarrito).not.toHaveBeenCalled();

    registrar.mockResolvedValueOnce({ id: 8, folio: 'folio-8', estado: 'pagado', total: 166 });
    await componente.confirmarPago();
    expect(registrar.mock.calls[1]).toEqual(registrar.mock.calls[2]);
    expect(vaciarCarrito).toHaveBeenCalledOnce();
    expect(cerrarIntento).toHaveBeenCalledWith('huella');
    expect(navegar).toHaveBeenCalledWith(['/confirmacion-pedido'], { queryParams: { folio: 'folio-8' } });
  });

  it('conserva el carrito si hay stock insuficiente y exige revisar una cotización nueva', async () => {
    const componente = fixture.componentInstance;
    componente.elegirDireccion(7);
    componente.telefonoEntrega = '8681234567';
    await componente.siguientePaso();
    componente.aceptaTerminos = true;
    registrar.mockRejectedValueOnce(new Error('STOCK_INSUFICIENTE_O_INVALIDO'));
    await componente.confirmarPago();
    expect(componente.errorCompra).toContain('existencias');
    expect(vaciarCarrito).not.toHaveBeenCalled();

    registrar.mockResolvedValueOnce({ ...cotizacion, envio: 60, total: 176 });
    await componente.confirmarPago();
    expect(componente.cotizacion?.total).toBe(176);
    expect(componente.aceptaTerminos).toBe(false);
    expect(vaciarCarrito).not.toHaveBeenCalled();
  });
});
