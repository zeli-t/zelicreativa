import { Component, computed, effect, inject, linkedSignal, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Carrito, LIMITE_POR_VARIANTE } from '../../services/carrito';
import { Catalogo } from '../../services/catalogo';

@Component({
  selector: 'app-detalle-producto',
  standalone: false,
  templateUrl: './detalle-producto.html',
  styleUrl: './detalle-producto.css'
})
export class DetalleProducto implements OnInit {

  readonly catalogo = inject(Catalogo);
  private readonly route = inject(ActivatedRoute);
  private readonly carrito = inject(Carrito);
  private readonly parametros = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly productoSeleccionado = computed(() => {
    const referencia = this.parametros().get('producto');
    return this.catalogo.contenido().productos.find(p => p.slug === referencia || p.nombre === referencia);
  });

  get producto() {
    return this.productoSeleccionado();
  }

  readonly imagenId = linkedSignal(() => this.productoSeleccionado()?.imagenes?.[0]?.id ?? null);
  readonly imagen = computed(() => this.productoSeleccionado()?.imagenes?.find(i => i.id === this.imagenId()));
  readonly aviso = signal('');
  readonly limite = LIMITE_POR_VARIANTE;
  cantidad = 1;
  variante: number | null = null;

  get varianteElegida() { return this.producto?.variantes.find(v => v.id === this.variante); }
  get disponibilidad(): boolean | undefined {
    return this.variante === null ? undefined : this.catalogo.disponibilidad().get(this.variante);
  }

  constructor() {
    effect(() => {
      const variantes = this.productoSeleccionado()?.variantes ?? [];
      this.variante = variantes.find(v => v.predeterminada)?.id ??
        (variantes.length === 1 ? variantes[0].id : null);
      this.cantidad = 1;
      this.aviso.set('');
    });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    await this.catalogo.cargar();
    await this.catalogo.actualizarDisponibilidad();
  }

  elegirVariante(id: number | null): void {
    this.variante = id;
    this.cantidad = 1;
    this.aviso.set('');
  }

  aumentarCantidad(): void { if (this.cantidad < this.limite) this.cantidad++; }
  disminuirCantidad(): void { if (this.cantidad > 1) this.cantidad--; }

  agregarAlCarrito(): void {
    const producto = this.producto;
    if (!producto || this.variante === null || this.disponibilidad === false) return;
    this.aviso.set(this.carrito.agregarProducto(producto.slug, this.variante, this.cantidad)
      ? 'Producto agregado al carrito.'
      : 'Esta variante no está disponible o la cantidad supera el límite de 10 unidades.');
  }

}
