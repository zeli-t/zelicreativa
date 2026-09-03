import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-confirmacion-pedido',
  standalone: false,
  templateUrl: './confirmacion-pedido.html',
  styleUrl: './confirmacion-pedido.css'
})
export class ConfirmacionPedido implements OnInit {

  pedido: any = null;

  constructor(
    private carrito: Carrito,
    private router: Router
  ) {}

  ngOnInit() {

    const datos = localStorage.getItem('pedidoZeli');

    if (datos) {

      this.pedido = JSON.parse(datos);

      // Vaciar el carrito después de completar la compra
      this.carrito.vaciarCarrito();

    } else {

      this.router.navigate(['/inicio']);

    }

  }

  volverTienda() {

    localStorage.removeItem('pedidoZeli');

    this.router.navigate(['/inicio']);

  }

}