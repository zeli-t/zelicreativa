import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-detalle-producto',
  standalone: false,
  templateUrl: './detalle-producto.html',
  styleUrl: './detalle-producto.css'
})
export class DetalleProducto implements OnInit {

  producto: any = null;

  cantidad = 1;

  variante = 'Rosa';

  productos = [

    {
      nombre: 'Libreta personalizada',
      precio: 180,
      imagen: '2.jpg',
      categoria: 'Libretas',
      oferta: false,
      precioAnterior: 0
    },

    {
      nombre: 'Set de plumas',
      precio: 95,
      imagen: 'plumas.jpg',
      categoria: 'Escritura',
      oferta: false,
      precioAnterior: 0
    },

    {
      nombre: 'Marcadores permanentes',
      precio: 120,
      imagen: 'marcadores2.jpg',
      categoria: 'Marcadores',
      oferta: true,
      precioAnterior: 150
    },

    {
      nombre: 'Pack de stickers',
      precio: 65,
      imagen: 'stickers.jpg',
      categoria: 'Stickers',
      oferta: false,
      precioAnterior: 0
    }

  ];

  constructor(
    private route: ActivatedRoute,
    private carrito: Carrito
  ) {}

  ngOnInit() {

    this.route.queryParams.subscribe(params => {

      const nombre = params['producto'];

      this.producto = this.productos.find(
        producto => producto.nombre === nombre
      );

    });

  }

  aumentarCantidad() {

    if (this.cantidad < 10) {

      this.cantidad++;

    } else {

      alert('Has alcanzado el límite de inventario.');

    }

  }

  disminuirCantidad() {

    if (this.cantidad > 1) {

      this.cantidad--;

    }

  }

  agregarAlCarrito() {

    for (let i = 0; i < this.cantidad; i++) {

      this.carrito.agregarProducto(this.producto);

    }

    alert('Producto agregado al carrito 🛒');

  }

}