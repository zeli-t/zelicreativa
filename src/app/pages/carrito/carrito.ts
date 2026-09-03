import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Carrito as CarritoService } from '../../services/carrito';

@Component({
  selector: 'app-carrito',
  standalone: false,
  templateUrl: './carrito.html',
  styleUrl: './carrito.css'
})
export class Carrito implements OnInit {

  productos: any[] = [];
  subtotal = 0;
  impuestos = 0;
  envio = 0;
  total = 0;

  constructor(
    private carrito: CarritoService,
    private router: Router
  ) {}

  ngOnInit() {

    this.carrito.carrito$.subscribe(productos => {

      this.productos = productos;

      this.subtotal = this.carrito.obtenerSubtotal();

      this.impuestos = this.subtotal * 0.16;

      this.envio = this.subtotal > 0 ? 60 : 0;

      this.total =
        this.subtotal +
        this.impuestos +
        this.envio;

    });

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

  irAlCheckout() {
    this.router.navigate(['/checkout']);
  }

}