import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-card-producto',
  standalone: false,
  templateUrl: './card-producto.html',
  styleUrl: './card-producto.css'
})
export class CardProducto implements OnInit {

  @Input() nombre = '';
  @Input() precio = 0;
  @Input() imagen = '';
  @Input() oferta = false;
  @Input() precioAnterior = 0;

  mostrarQuickView = false;
  favorito = false;

  constructor(
    private carrito: Carrito,
    private router: Router
  ) {}

  ngOnInit() {

    const favoritos = JSON.parse(
      localStorage.getItem('favoritosZeli') || '[]'
    );

    this.favorito = favoritos.some(
      (producto: any) => producto.nombre === this.nombre
    );

  }

  agregarAlCarrito() {

    const producto = {
      nombre: this.nombre,
      precio: this.precio,
      imagen: this.imagen
    };

    this.carrito.agregarProducto(producto);

    alert('Producto agregado al carrito 🛒');

  }

  cambiarFavorito() {

    let favoritos = JSON.parse(
      localStorage.getItem('favoritosZeli') || '[]'
    );

    if (this.favorito) {

      favoritos = favoritos.filter(
        (producto: any) => producto.nombre !== this.nombre
      );

      this.favorito = false;

    } else {

      favoritos.push({
        nombre: this.nombre,
        precio: this.precio,
        imagen: this.imagen
      });

      this.favorito = true;

    }

    localStorage.setItem(
      'favoritosZeli',
      JSON.stringify(favoritos)
    );

  }

  abrirQuickView() {
    this.mostrarQuickView = true;
  }

  cerrarQuickView() {
    this.mostrarQuickView = false;
  }

  verDetalle() {

    this.router.navigate(
      ['/detalle-producto'],
      {
        queryParams: {
          producto: this.nombre
        }
      }
    );

  }

}