import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  readonly enlaces = [
    { texto: 'Inicio', ruta: '/inicio' },
    { texto: 'Catálogo', ruta: '/catalogo' },
    { texto: 'Libretas', ruta: '/categoria/libretas' },
    { texto: 'Escritura', ruta: '/categoria/escritura' },
    { texto: 'Stickers', ruta: '/categoria/stickers' },
  ];
}
