import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-quick-view',
  standalone: false,
  styleUrl: './quick-view.css',
  templateUrl: './quick-view.html',
})
export class QuickView {

  @Input() producto: any;

  @Output() cerrar = new EventEmitter<void>();

  constructor(private carrito: Carrito) {}

  cerrarVentana() {
    this.cerrar.emit();
  }

  agregarAlCarrito() {

    this.carrito.agregarProducto(this.producto);

    alert('Producto agregado al carrito 🛒');

    this.cerrarVentana();

  }

}