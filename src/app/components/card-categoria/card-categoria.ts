import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-card-categoria',
  standalone: false,
  templateUrl: './card-categoria.html',
  styleUrl: './card-categoria.css'
})
export class CardCategoria {

  @Input() nombre = '';
  @Input() descripcion = '';
  @Input() imagen = '';

  constructor(private router: Router) {}

  verProductos() {

    this.router.navigate(
      ['/inicio'],
      {
        queryParams: {
          categoria: this.nombre
        }
      }
    );

  }

}

