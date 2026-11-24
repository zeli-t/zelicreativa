import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Carrito as CarritoService } from '../../services/carrito';

@Component({
  selector: 'app-carrito',
  standalone: false,
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class Carrito {
  readonly carrito = inject(CarritoService);
  private readonly router = inject(Router);
  private readonly partidas = toSignal(this.carrito.carrito$, { requireSync: true });

  get productos() { return this.partidas(); }
  get subtotal() { return this.carrito.obtenerSubtotal(); }
  get impuestos() { return this.subtotal * 0.16; }
  get envio() { return this.subtotal > 0 ? 60 : 0; }
  get total() { return this.subtotal + this.impuestos + this.envio; }

  seleccionarVariante(clave: string, selector: HTMLSelectElement): void {
    if (selector.value && !this.carrito.seleccionarVariante(clave, Number(selector.value))) {
      selector.value = '';
      alert('La variante no está disponible o superaría 10 unidades. Ajusta la cantidad o elige otra variante.');
    }
  }

  async irAlCheckout(): Promise<void> {
    if (this.carrito.puedeContinuar() && await this.carrito.verificarParaCompra()) {
      await this.router.navigate(['/checkout']);
    }
  }
}
