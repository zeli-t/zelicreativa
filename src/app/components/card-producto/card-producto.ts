import { Component, Input, OnInit } from '@angular/core';
import { Carrito } from '../../services/carrito';
import type { VarianteCatalogo } from '../../services/catalogo';

@Component({
  selector: 'app-card-producto',
  standalone: false,
  templateUrl: './card-producto.html',
  styleUrl: './card-producto.css'
})
export class CardProducto implements OnInit {

  @Input() slug = '';
  @Input() nombre = '';
  @Input() precio = 0;
  @Input() imagen = '';
  @Input() descripcion = '';
  @Input() oferta = false;
  @Input() precioAnterior = 0;
  @Input() variantes: VarianteCatalogo[] = [];

  mostrarQuickView = false;
  favorito = false;

  constructor(
    private carrito: Carrito
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

    const variante = this.variantes.find(v => v.predeterminada) ??
      (this.variantes.length === 1 ? this.variantes[0] : undefined);
    if (!variante) {
      this.abrirQuickView();
      return;
    }
    alert(this.carrito.agregarProducto(this.slug, variante.id)
      ? 'Producto agregado al carrito 🛒'
      : 'Esta variante no está disponible o alcanzó el límite de 10 unidades.');

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

}
