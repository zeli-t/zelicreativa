import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-inicio',
  standalone: false,
  styleUrl: './inicio.css',
  templateUrl: './inicio.html'
})
export class Inicio implements OnInit {

  busqueda = '';
  categoriaSeleccionada = 'Todas';
  precioMaximo = 500;
  orden = 'normal';

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
      imagen: 'marcadores.jpg',
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

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {

    this.route.queryParams.subscribe(params => {

      if (params['categoria']) {
        this.categoriaSeleccionada = params['categoria'];
      }

      if (params['buscar']) {
        this.busqueda = params['buscar'];
      }

    });

  }

  get productosFiltrados() {

    let resultado = this.productos.filter(producto => {

      const coincideBusqueda =
        producto.nombre
          .toLowerCase()
          .includes(this.busqueda.toLowerCase());

      const coincideCategoria =
        this.categoriaSeleccionada === 'Todas' ||
        producto.categoria === this.categoriaSeleccionada;

      const coincidePrecio =
        producto.precio <= this.precioMaximo;

      return coincideBusqueda &&
             coincideCategoria &&
             coincidePrecio;

    });

    if (this.orden === 'menor') {
      resultado.sort((a, b) => a.precio - b.precio);
    }

    if (this.orden === 'mayor') {
      resultado.sort((a, b) => b.precio - a.precio);
    }

    if (this.orden === 'nombre') {
      resultado.sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      );
    }

    return resultado;
  }

  seleccionarCategoria(categoria: string) {
    this.categoriaSeleccionada = categoria;
  }

}
