import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-card-categoria',
  standalone: false,
  templateUrl: './card-categoria.html',
  styleUrl: './card-categoria.css',
})
export class CardCategoria {
  @Input() nombre = '';
  @Input() slug = '';
  @Input() descripcion = '';
  @Input() imagen = '';
}
