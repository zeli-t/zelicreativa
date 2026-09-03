import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-header',
  standalone: false,
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header implements OnInit {

  carritoAbierto = false;
  cantidadCarrito = 0;

  busqueda = '';
  sugerencias: string[] = [];

  productos = [
    'Libreta personalizada',
    'Set de plumas',
    'Marcadores permanentes',
    'Pack de stickers'
  ];

  constructor(
    private carrito: Carrito,
    private router: Router
  ) {}

  ngOnInit() {

    this.carrito.carrito$.subscribe(productos => {

      this.cantidadCarrito = productos.reduce(
        (total, producto) => total + producto.cantidad,
        0
      );

    });

  }

  buscar() {

    const texto = this.busqueda.toLowerCase().trim();

    if (!texto) {
      this.sugerencias = [];
      return;
    }

    this.sugerencias = this.productos.filter(producto =>
      producto.toLowerCase().includes(texto)
    );

  }

  seleccionarSugerencia(producto: string) {

    this.busqueda = producto;
    this.sugerencias = [];

    this.router.navigate(
      ['/inicio'],
      {
        queryParams: {
          buscar: producto
        }
      }
    );

  }

  realizarBusqueda() {

    this.sugerencias = [];

    this.router.navigate(
      ['/inicio'],
      {
        queryParams: {
          buscar: this.busqueda
        }
      }
    );

  }

  abrirCarrito() {
    this.carritoAbierto = true;
  }

  cerrarCarrito() {
    this.carritoAbierto = false;
  }

}