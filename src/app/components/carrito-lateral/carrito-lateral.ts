import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-carrito-lateral',
  standalone: false,
  styleUrl: './carrito-lateral.css',
  templateUrl: './carrito-lateral.html',
})
export class CarritoLateral implements OnInit {

  @Output() cerrar = new EventEmitter<void>();

  productos: any[] = [];
  subtotal = 0;

  constructor(private carrito: Carrito) {}

  ngOnInit() {

    this.carrito.carrito$.subscribe(productos => {

      this.productos = productos;

      this.subtotal = this.carrito.obtenerSubtotal();

    });

  }

  cerrarCarrito() {
    this.cerrar.emit();
  }

  aumentarCantidad(nombre: string) {
    this.carrito.aumentarCantidad(nombre);
  }

  disminuirCantidad(nombre: string) {
    this.carrito.disminuirCantidad(nombre);
  }

  eliminarProducto(nombre: string) {
    this.carrito.eliminarProducto(nombre);
  }

}