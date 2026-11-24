import { Component, computed, inject, linkedSignal, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Catalogo, disponibilidadProducto } from '../../services/catalogo';

@Component({
  selector: 'app-catalogo-pagina',
  standalone: false,
  templateUrl: './catalogo-pagina.html',
  styleUrl: './catalogo-pagina.css',
})
export class CatalogoPagina implements OnInit {
  readonly catalogo = inject(Catalogo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly parametros = toSignal(this.route.paramMap, { requireSync: true });
  private readonly consulta = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly esRutaCategoria = computed(() => this.parametros().has('slug'));
  readonly referencia = computed(() => this.parametros().get('slug') || this.consulta().get('categoria') || '');
  readonly categoria = computed(() => this.catalogo.contenido().categorias.find(
    categoria => categoria.slug === this.referencia() || categoria.nombre === this.referencia(),
  ));
  readonly busqueda = linkedSignal(() => this.consulta().get('buscar') ?? '');
  readonly precioMaximo = signal<number | null>(null);
  readonly orden = signal('normal');
  readonly filtroStock = signal('todos');
  readonly productos = computed(() => {
    const categoria = this.categoria();
    if (this.referencia() && !categoria) return [];

    const texto = this.busqueda().trim().toLocaleLowerCase('es');
    const limite = this.precioMaximo();
    const filtro = this.filtroStock();
    const stock = filtro === 'todos' ? null : this.catalogo.disponibilidad();
    const resultado = this.catalogo.contenido().productos.filter(producto =>
      (!categoria || producto.categoriaId === categoria.id) &&
      producto.nombre.toLocaleLowerCase('es').includes(texto) &&
      (limite === null || producto.precio <= limite) &&
      (!stock || disponibilidadProducto(producto, stock) === (filtro === 'disponibles')),
    );
    switch (this.orden()) {
      case 'menor': return resultado.sort((a, b) => a.precio - b.precio);
      case 'mayor': return resultado.sort((a, b) => b.precio - a.precio);
      case 'nombre': return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      default: return resultado;
    }
  });
  private readonly tamanoPagina = 12;
  readonly pagina = linkedSignal(() => {
    this.productos();
    return 1;
  });
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.productos().length / this.tamanoPagina)));
  readonly inicio = computed(() => (this.pagina() - 1) * this.tamanoPagina);
  readonly visibles = computed(() => this.productos().slice(this.inicio(), this.inicio() + this.tamanoPagina));

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    await this.catalogo.cargar();
    await this.catalogo.actualizarDisponibilidad();
  }

  moverPagina(paso: number): void {
    this.pagina.update(pagina => Math.min(this.paginas(), Math.max(1, pagina + paso)));
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
  }

  cambiarCategoria(slug: string): void {
    const ruta = slug ? ['/categoria', slug] : ['/catalogo'];
    void this.router.navigate(ruta, { queryParams: { buscar: this.busqueda().trim() || null } });
  }

  limpiarFiltros(): void {
    this.cambiarBusqueda('');
    this.precioMaximo.set(null);
    this.orden.set('normal');
    this.filtroStock.set('todos');
  }
}
