import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Catalogo } from '../../services/catalogo';

@Component({
  selector: 'app-inicio',
  standalone: false,
  styleUrl: './inicio.css',
  templateUrl: './inicio.html',
})
export class Inicio implements OnInit {
  readonly catalogo = inject(Catalogo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly recomendados = computed(() => {
    const { productos, categorias } = this.catalogo.contenido();
    return categorias.flatMap(categoria =>
      productos.filter(producto => producto.categoriaId === categoria.id).slice(0, 2),
    ).slice(0, 6);
  });

  ngOnInit(): void {
    const { categoria, buscar } = this.route.snapshot.queryParams;
    if (categoria || buscar) {
      void this.router.navigate(['/catalogo'], { queryParams: { categoria, buscar }, replaceUrl: true });
      return;
    }
    void this.catalogo.cargar();
  }
}
