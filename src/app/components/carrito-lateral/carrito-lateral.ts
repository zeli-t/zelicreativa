import { Component, EventEmitter, Output, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-carrito-lateral',
  standalone: false,
  styleUrl: './carrito-lateral.css',
  templateUrl: './carrito-lateral.html',
})
export class CarritoLateral {
  @Output() cerrar = new EventEmitter<void>();

  readonly carrito = inject(Carrito);
  private readonly partidas = toSignal(this.carrito.carrito$, { requireSync: true });
  get productos() { return this.partidas(); }
  get subtotal() { return this.carrito.obtenerSubtotal(); }

  cerrarCarrito(): void {
    this.cerrar.emit();
  }
}
