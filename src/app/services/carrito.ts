import { Injectable, effect, inject, untracked } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Catalogo, ProductoCatalogo, VarianteCatalogo } from './catalogo';

export const LIMITE_POR_VARIANTE = 10;

export interface PartidaCarrito {
  clave: string;
  varianteId?: number;
  variante?: string;
  requiereSeleccion?: boolean;
  slug?: string;
  nombre: string;
  imagen: string;
  precio: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class Carrito {
  private readonly catalogo = inject(Catalogo);
  private readonly productos = new BehaviorSubject(this.cargarCarrito());
  readonly carrito$ = this.productos.asObservable();
  readonly estadoCatalogo = this.catalogo.estadoCarga;

  verificarCatalogo(): void {
    void this.catalogo.cargar();
  }

  constructor() {
    effect(() => {
      if (this.estadoCatalogo() !== 'listo') return;
      const productos = this.catalogo.contenido().productos;
      untracked(() => this.reconciliar(productos));
    });
  }

  agregarProducto(slug: string, varianteId: number, cantidad = 1): boolean {
    if (!Number.isInteger(cantidad) || cantidad < 1 || this.estadoCatalogo() !== 'listo') return false;
    const producto = this.catalogo.contenido().productos.find(p => p.slug === slug);
    const variante = producto?.variantes.find(v => v.id === varianteId);
    if (!producto || !variante) return false;

    const entrada = this.crearPartida(producto, variante, cantidad);
    const partidas = this.productos.value.slice();
    if (!this.combinar(partidas, entrada)) return false;
    this.guardar(partidas);
    return true;
  }

  opciones(partida: PartidaCarrito): readonly VarianteCatalogo[] {
    return this.coincidencias(partida).flatMap(p => p.variantes);
  }

  esValida(partida: PartidaCarrito): boolean {
    return this.estadoCatalogo() === 'listo' && partida.varianteId !== undefined &&
      this.opciones(partida).some(v => v.id === partida.varianteId);
  }

  seleccionarVariante(clave: string, id: number): boolean {
    const partida = this.productos.value.find(p => p.clave === clave);
    if (!partida || this.esValida(partida) || this.estadoCatalogo() !== 'listo') return false;
    const producto = this.coincidencias(partida).find(p => p.variantes.some(v => v.id === id));
    const variante = producto?.variantes.find(v => v.id === id);
    if (!producto || !variante) return false;

    const partidas = this.productos.value.filter(p => p.clave !== clave);
    if (!this.combinar(partidas, this.crearPartida(producto, variante, partida.cantidad))) return false;
    this.guardar(partidas);
    return true;
  }

  aumentarCantidad(clave: string): boolean {
    const partida = this.productos.value.find(p => p.clave === clave);
    if (!partida || !this.esValida(partida) || partida.cantidad >= LIMITE_POR_VARIANTE) return false;
    this.guardar(this.productos.value.map(p => p.clave === clave ? { ...p, cantidad: p.cantidad + 1 } : p));
    return true;
  }

  disminuirCantidad(clave: string): void {
    const partida = this.productos.value.find(p => p.clave === clave);
    if (!partida) return;
    if (partida.cantidad === 1) this.eliminarProducto(clave);
    else this.guardar(this.productos.value.map(p => p.clave === clave ? { ...p, cantidad: p.cantidad - 1 } : p));
  }

  eliminarProducto(clave: string): void {
    this.guardar(this.productos.value.filter(p => p.clave !== clave));
  }

  vaciarCarrito(): void {
    this.guardar([]);
  }

  puedeContinuar(): boolean {
    return this.productos.value.length > 0 && this.productos.value.every(p => this.esValida(p));
  }

  async verificarParaCompra(): Promise<boolean> {
    await this.catalogo.cargar(true);
    return this.puedeContinuar();
  }

  obtenerCantidad(): number {
    return this.productos.value.reduce((total, p) => total + p.cantidad, 0);
  }

  obtenerSubtotal(): number {
    return this.productos.value.reduce((total, p) => total + (this.esValida(p) ? p.precio * p.cantidad : 0), 0);
  }

  private coincidencias(
    partida: PartidaCarrito, productos = this.catalogo.contenido().productos,
  ): ProductoCatalogo[] {
    return productos.filter(p => partida.slug ? p.slug === partida.slug : p.nombre === partida.nombre);
  }

  private crearPartida(producto: ProductoCatalogo, variante: VarianteCatalogo, cantidad: number): PartidaCarrito {
    return {
      clave: 'variante-' + variante.id, varianteId: variante.id, variante: variante.nombre,
      slug: producto.slug, nombre: producto.nombre, imagen: producto.imagen,
      precio: Math.round((producto.precio + variante.precioAdicional) * 100) / 100, cantidad,
    };
  }

  private combinar(partidas: PartidaCarrito[], entrada: PartidaCarrito): boolean {
    const indice = partidas.findIndex(p => p.varianteId === entrada.varianteId && this.esValida(p));
    const cantidad = entrada.cantidad + (indice < 0 ? 0 : partidas[indice].cantidad);
    if (cantidad > LIMITE_POR_VARIANTE) return false;
    if (indice < 0) partidas.push(entrada);
    else partidas[indice] = { ...entrada, cantidad };
    return true;
  }

  private reconciliar(productos: ProductoCatalogo[]): void {
    if (!this.productos.value.length) return;
    const partidas: PartidaCarrito[] = [];
    const originales = this.productos.value;
    // Primero conserva las variantes ya elegidas. Después intenta migrar las entradas antiguas.
    const ordenadas = [...originales.filter(p => p.varianteId !== undefined), ...originales.filter(p => p.varianteId === undefined)];
    for (const partida of ordenadas) {
      const coincidencias = this.coincidencias(partida, productos);
      const producto = coincidencias.length === 1 ? coincidencias[0] : undefined;
      const variante = partida.requiereSeleccion ? undefined : partida.varianteId === undefined
        ? producto?.variantes.length === 1 ? producto.variantes[0] : undefined
        : producto?.variantes.find(v => v.id === partida.varianteId);
      if (!producto || !variante || !this.combinar(partidas, this.crearPartida(producto, variante, partida.cantidad))) {
        partidas.push({
          ...partida, clave: 'pendiente-' + partidas.length,
          varianteId: undefined, variante: undefined,
          // Una selección que dejó de existir requiere una nueva elección incluso tras recargar.
          requiereSeleccion: partida.requiereSeleccion || partida.varianteId !== undefined ||
            coincidencias.length > 1 || (producto?.variantes.length ?? 0) > 1,
        });
      }
    }
    this.guardar(partidas);
  }

  private guardar(partidas: PartidaCarrito[]): void {
    this.productos.next(partidas);
    try {
      globalThis.localStorage?.setItem('carritoZeli', JSON.stringify(partidas));
    } catch {
      // El carrito sigue disponible en memoria cuando el navegador bloquea el almacenamiento.
    }
  }

  private cargarCarrito(): PartidaCarrito[] {
    try {
      const guardado: unknown = JSON.parse(globalThis.localStorage?.getItem('carritoZeli') ?? '[]');
      if (!Array.isArray(guardado)) return [];
      return guardado.flatMap((p, indice) => {
        if (!p || typeof p.nombre !== 'string' || !Number.isInteger(p.cantidad) || p.cantidad < 1) return [];
        const varianteId = Number.isSafeInteger(p.varianteId) && p.varianteId > 0 ? Number(p.varianteId) : undefined;
        return [{
          clave: 'guardada-' + indice, varianteId,
          requiereSeleccion: p.requiereSeleccion === true,
          slug: typeof p.slug === 'string' ? p.slug : undefined,
          variante: typeof p.variante === 'string' ? p.variante : undefined,
          nombre: p.nombre, imagen: typeof p.imagen === 'string' ? p.imagen : '',
          precio: typeof p.precio === 'number' && Number.isFinite(p.precio) ? p.precio : 0,
          cantidad: Math.min(p.cantidad, LIMITE_POR_VARIANTE),
        }];
      });
    } catch {
      return [];
    }
  }
}
