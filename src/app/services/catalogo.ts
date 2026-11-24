import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface CategoriaCatalogo {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  imagen: string;
}

export interface VarianteCatalogo {
  id: number;
  sku: string;
  nombre: string;
  predeterminada: boolean;
  precioAdicional: number;
}

export interface ProductoCatalogo {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioAnterior: number;
  oferta: boolean;
  imagen: string;
  imagenes?: { id: number; ruta: string; texto: string }[];
  categoriaId: number;
  variantes: VarianteCatalogo[];
}

const portadas: Record<string, string> = {
  libretas: 'libreta.jpg',
  escritura: 'marcadores2.jpg',
  stickers: 'stickers.jpg',
};

@Injectable({ providedIn: 'root' })
export class Catalogo {
  private readonly datos = signal<{ categorias: CategoriaCatalogo[]; productos: ProductoCatalogo[] }>({
    categorias: [],
    productos: [],
  });
  private readonly estado = signal<'pendiente' | 'cargando' | 'listo' | 'error'>('pendiente');
  private readonly mensaje = signal('');
  private carga?: Promise<void>;
  private consultaDisponibilidad?: { productos: ProductoCatalogo[]; resultado: Promise<void> };
  private readonly stock = signal<ReadonlyMap<number, boolean>>(new Map());
  readonly disponibilidad = this.stock.asReadonly();
  readonly estadoDisponibilidad = signal<'pendiente' | 'cargando' | 'listo' | 'error'>('pendiente');

  readonly contenido = this.datos.asReadonly();
  readonly estadoCarga = this.estado.asReadonly();
  readonly error = this.mensaje.asReadonly();

  cargar(forzar = false): Promise<void> {
    if (this.carga) return this.carga;
    if (!forzar && this.estado() === 'listo') return Promise.resolve();
    this.carga = this.cargarDatos().finally(() => { this.carga = undefined; });
    return this.carga;
  }

  actualizarDisponibilidad(): Promise<void> {
    if (this.estado() !== 'listo') return Promise.resolve();
    const productos = this.datos().productos;
    if (this.consultaDisponibilidad?.productos === productos) return this.consultaDisponibilidad.resultado;
    const resultado = this.consultarDisponibilidad(productos).finally(() => {
      if (this.consultaDisponibilidad?.resultado === resultado) this.consultaDisponibilidad = undefined;
    });
    this.consultaDisponibilidad = { productos, resultado };
    return resultado;
  }

  private async consultarDisponibilidad(productos: ProductoCatalogo[]): Promise<void> {
    const ids = productos.flatMap(p => p.variantes.map(v => v.id));
    this.estadoDisponibilidad.set('cargando');
    try {
      const stock = new Map<number, boolean>();
      for (let inicio = 0; inicio < ids.length; inicio += 100) {
        const respuesta = await fetch(environment.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/disponibilidad_catalogo', {
          method: 'POST',
          headers: { apikey: environment.supabasePublishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_variantes: ids.slice(inicio, inicio + 100) }),
          signal: AbortSignal.timeout(10000),
        });
        if (!respuesta.ok) throw new Error('DISPONIBILIDAD_NO_DISPONIBLE');
        const filas: { variante_id: number; disponible: boolean }[] = await respuesta.json();
        for (const fila of filas) stock.set(fila.variante_id, fila.disponible);
      }
      if (this.datos().productos !== productos) return;
      this.stock.set(stock);
      this.estadoDisponibilidad.set('listo');
    } catch {
      if (this.datos().productos !== productos) return;
      this.stock.set(new Map());
      this.estadoDisponibilidad.set('error');
    }
  }

  private async cargarDatos(): Promise<void> {
    this.mensaje.set('');
    const clave = environment.supabasePublishableKey.trim();
    if (!clave.startsWith('sb_publishable_') || clave.length <= 'sb_publishable_'.length) {
      this.mensaje.set('El catálogo requiere la clave publicable de Supabase.');
      this.estado.set('error');
      return;
    }

    this.estado.set('cargando');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const cliente = createClient(environment.supabaseUrl, clave, {
        auth: {
          storageKey: 'zeli-catalogo-publico',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const categorias = await cliente.from('categorias').select('id, slug, nombre, descripcion').order('id');
      if (categorias.error) throw categorias.error;

      const fichas: ProductoCatalogo[] = [];
      const tamano = 200;
      for (let inicio = 0; ; inicio += tamano) {
        const productos = await cliente.from('productos')
          .select('id, slug, nombre, descripcion, precio, precio_anterior, categoria_id, imagenes_producto(ruta, texto_alternativo, principal, orden, id), variantes_producto(id, sku, nombre, predeterminada, precio_adicional)')
          .eq('activo', true)
          .eq('variantes_producto.activa', true)
          .order('id').range(inicio, inicio + tamano - 1);
        if (productos.error) throw productos.error;
        for (const fila of productos.data) {
          const imagenes = fila.imagenes_producto.filter(i => i.ruta.trim()).sort((a, b) =>
            Number(b.principal) - Number(a.principal) || a.orden - b.orden || a.id - b.id,
          ).map(i => ({ id: i.id, ruta: i.ruta, texto: i.texto_alternativo }));
          fichas.push({
            id: fila.id, slug: fila.slug, nombre: fila.nombre, descripcion: fila.descripcion,
            precio: Number(fila.precio), precioAnterior: Number(fila.precio_anterior ?? 0),
            oferta: fila.precio_anterior !== null, imagen: imagenes[0]?.ruta || 'zc.png',
            imagenes, categoriaId: fila.categoria_id,
            variantes: fila.variantes_producto.sort((a, b) =>
              Number(b.predeterminada) - Number(a.predeterminada) || a.id - b.id,
            ).map(v => ({ id: v.id, sku: v.sku, nombre: v.nombre, predeterminada: v.predeterminada, precioAdicional: Number(v.precio_adicional) })),
          });
        }
        if (productos.data.length < tamano) break;
      }
      this.stock.set(new Map());
      this.estadoDisponibilidad.set('pendiente');
      this.datos.set({
        productos: fichas,
        categorias: categorias.data.map(fila => ({
          ...fila,
          imagen: portadas[fila.slug] || fichas.find(producto => producto.categoriaId === fila.id)?.imagen || 'zc.png',
        })),
      });
      this.estado.set('listo');
    } catch (error) {
      console.error('Error al consultar el catálogo público de Supabase', error);
      this.mensaje.set('No pudimos cargar el catálogo. Intenta de nuevo.');
      this.estado.set('error');
    }
  }
}

export function disponibilidadProducto(producto: ProductoCatalogo, stock: ReadonlyMap<number, boolean>): boolean | undefined {
  if (producto.variantes.some(variante => stock.get(variante.id) === true)) return true;
  if (producto.variantes.every(variante => stock.get(variante.id) === false)) return false;
  return undefined;
}
