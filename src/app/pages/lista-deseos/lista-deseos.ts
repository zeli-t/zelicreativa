import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-lista-deseos',
  standalone: false,
  templateUrl: './lista-deseos.html',
  styleUrl: './lista-deseos.css'
})
export class ListaDeseos implements OnInit {

  favoritos: any[] = [];

  ngOnInit() {

    this.cargarFavoritos();

  }

  cargarFavoritos() {

    const datos = localStorage.getItem('favoritosZeli');

    this.favoritos = datos
      ? JSON.parse(datos)
      : [];

  }

  eliminarFavorito(nombre: string) {

    this.favoritos = this.favoritos.filter(
      producto => producto.nombre !== nombre
    );

    localStorage.setItem(
      'favoritosZeli',
      JSON.stringify(this.favoritos)
    );

  }

}