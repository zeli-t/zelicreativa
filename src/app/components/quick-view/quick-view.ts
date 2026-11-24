import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, viewChild } from '@angular/core';
import { Carrito } from '../../services/carrito';
import type { VarianteCatalogo } from '../../services/catalogo';

@Component({
  selector: 'app-quick-view',
  standalone: false,
  templateUrl: './quick-view.html',
  styleUrl: './quick-view.css',
})
export class QuickView implements AfterViewInit {
  @Input() producto!: { slug: string; nombre: string; precio: number; imagen: string; descripcion?: string; variantes: VarianteCatalogo[] };
  @Output() cerrar = new EventEmitter<void>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  varianteId: number | null = null;

  constructor(private readonly carrito: Carrito) {}

  ngAfterViewInit(): void {
    if (this.producto) this.dialogo()?.nativeElement.showModal();
  }

  cerrarVentana(): void {
    this.dialogo()?.nativeElement.close();
    this.cerrar.emit();
  }

  cerrarDesdeFondo(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrarVentana();
  }

  agregarAlCarrito(): void {
    const id = this.varianteId ?? (this.producto.variantes.length === 1 ? this.producto.variantes[0].id : null);
    if (id === null || !this.carrito.agregarProducto(this.producto.slug, id)) {
      alert('Selecciona una variante disponible. El límite es de 10 unidades por variante.');
      return;
    }
    this.cerrarVentana();
    alert('Producto agregado al carrito 🛒');
  }
}
