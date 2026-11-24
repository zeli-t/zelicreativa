import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Carrito, PartidaCarrito } from './carrito';
import { Catalogo, ProductoCatalogo, VarianteCatalogo } from './catalogo';

const variante = (id: number, nombre: string, precioAdicional = 0): VarianteCatalogo => ({
  id, nombre, sku: 'SKU-' + id, predeterminada: id !== 12, precioAdicional,
});
const libreta: ProductoCatalogo = {
  id: 1, slug: 'libreta', nombre: 'Libreta', precio: 100, precioAnterior: 0, oferta: false,
  imagen: 'libreta.jpg', categoriaId: 1, descripcion: '', variantes: [variante(11, 'Rosa'), variante(12, 'Azul', 5)],
};
const pluma: ProductoCatalogo = {
  ...libreta, id: 2, slug: 'pluma', nombre: 'Pluma', variantes: [variante(21, 'Estándar')],
};

describe('Carrito por variante', () => {
  const clave = 'carritoZeli';
  const datosLocales = new Map<string, string>();
  const almacenamiento = {
    getItem: (key: string) => datosLocales.get(key) ?? null,
    setItem: (key: string, value: string) => datosLocales.set(key, value),
  };
  let contenido: ReturnType<typeof signal<{ productos: ProductoCatalogo[] }>>;
  let estado: ReturnType<typeof signal<'listo' | 'cargando'>>;
  let partidas: PartidaCarrito[];

  beforeEach(() => {
    datosLocales.clear();
    vi.stubGlobal('localStorage', almacenamiento);
    partidas = [];
    contenido = signal({ productos: [libreta, pluma] });
    estado = signal<'listo' | 'cargando'>('listo');
    TestBed.configureTestingModule({
      providers: [{ provide: Catalogo, useValue: { contenido, estadoCarga: estado } }],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  function abrir(guardadas?: object[]): Carrito {
    if (guardadas) almacenamiento.setItem(clave, JSON.stringify(guardadas));
    const carrito = TestBed.inject(Carrito);
    carrito.carrito$.subscribe(valor => partidas = valor);
    TestBed.tick();
    return carrito;
  }

  it('separa variantes de un producto y agrupa la misma variante', () => {
    const carrito = abrir();
    expect(carrito.agregarProducto('libreta', 11)).toBe(true);
    expect(carrito.agregarProducto('libreta', 12)).toBe(true);
    expect(carrito.agregarProducto('libreta', 11, 2)).toBe(true);
    expect(partidas.map(p => [p.varianteId, p.cantidad])).toEqual([[11, 3], [12, 1]]);
    expect(carrito.obtenerSubtotal()).toBe(405);
  });

  it('persiste y restaura las referencias por variante', () => {
    const carrito = abrir();
    carrito.agregarProducto('libreta', 12, 2);
    const guardadas = JSON.parse(almacenamiento.getItem(clave)!);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Catalogo, useValue: { contenido, estadoCarga: estado } }],
    });
    expect(abrir().puedeContinuar()).toBe(true);
    expect(partidas).toEqual(guardadas);
    expect(partidas[0].varianteId).toBe(12);
  });

  it('migra la única variante y solicita elegir para un producto ambiguo', () => {
    const carrito = abrir([{ nombre: 'Pluma', cantidad: 2 }, { nombre: 'Libreta', cantidad: 3 }]);
    expect(partidas.map(p => p.varianteId)).toEqual([21, undefined]);
    expect(carrito.puedeContinuar()).toBe(false);
    expect(carrito.obtenerSubtotal()).toBe(200);
    const pendiente = partidas[1];
    expect(carrito.opciones(pendiente).map(v => v.id)).toEqual([11, 12]);
    expect(carrito.seleccionarVariante(pendiente.clave, 12)).toBe(true);
    expect(partidas[1]).toMatchObject({ varianteId: 12, cantidad: 3 });
    expect(carrito.puedeContinuar()).toBe(true);
  });

  it('no elige entre productos con el mismo nombre', () => {
    contenido.set({ productos: [pluma, { ...libreta, nombre: pluma.nombre }] });
    const carrito = abrir([{ nombre: 'Pluma', cantidad: 1 }]);
    expect(partidas[0].varianteId).toBeUndefined();
    expect(carrito.opciones(partidas[0]).map(v => v.id)).toEqual([21, 11, 12]);
    expect(carrito.seleccionarVariante(partidas[0].clave, 11)).toBe(true);
    expect(partidas[0]).toMatchObject({ slug: 'libreta', varianteId: 11 });
  });

  it('conserva la elección pendiente si una variante guardada dejó de estar visible', () => {
    contenido.set({ productos: [{ ...libreta, variantes: [libreta.variantes[0]] }] });
    const carrito = abrir([{ nombre: 'Libreta', slug: 'libreta', varianteId: 12, cantidad: 3 }]);
    expect(carrito.puedeContinuar()).toBe(false);
    expect(carrito.agregarProducto('libreta', 12)).toBe(false);
    expect(carrito.agregarProducto('libreta', 999)).toBe(false);
    const guardadas = JSON.parse(almacenamiento.getItem(clave)!);
    expect(guardadas[0]).toMatchObject({ requiereSeleccion: true, cantidad: 3 });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Catalogo, useValue: { contenido, estadoCarga: estado } }],
    });
    expect(abrir().puedeContinuar()).toBe(false);
    expect(partidas[0].varianteId).toBeUndefined();
  });

  it('aplica diez por variante y elimina solo la partida indicada', () => {
    const carrito = abrir();
    expect(carrito.agregarProducto('libreta', 11, 9)).toBe(true);
    expect(carrito.agregarProducto('libreta', 11, 2)).toBe(false);
    expect(carrito.aumentarCantidad('variante-11')).toBe(true);
    expect(carrito.aumentarCantidad('variante-11')).toBe(false);
    expect(carrito.agregarProducto('libreta', 12, 10)).toBe(true);
    carrito.disminuirCantidad('variante-12');
    carrito.eliminarProducto('variante-11');
    expect(partidas.map(p => [p.varianteId, p.cantidad])).toEqual([[12, 9]]);
    carrito.eliminarProducto('variante-12');
    expect(carrito.agregarProducto('libreta', 11)).toBe(true);
    carrito.disminuirCantidad('variante-11');
    expect(partidas).toEqual([]);
  });

  it('espera al catálogo y rechaza IDs ajenos al producto', () => {
    estado.set('cargando');
    const carrito = abrir([{ nombre: 'Pluma', cantidad: 1 }]);
    expect(carrito.puedeContinuar()).toBe(false);
    expect(carrito.agregarProducto('pluma', 21)).toBe(false);
    estado.set('listo');
    TestBed.tick();
    expect(carrito.puedeContinuar()).toBe(true);
    expect(carrito.agregarProducto('pluma', 11)).toBe(false);
  });

  it('revalida el catálogo antes de comprar y detecta una variante retirada', async () => {
    TestBed.overrideProvider(Catalogo, { useValue: {
      contenido, estadoCarga: estado,
      cargar: async (forzar: boolean) => {
        expect(forzar).toBe(true);
        contenido.set({ productos: [{ ...libreta, variantes: [libreta.variantes[0]] }] });
      },
    } });
    const carrito = abrir();
    expect(carrito.agregarProducto('libreta', 12)).toBe(true);
    expect(await carrito.verificarParaCompra()).toBe(false);
  });
});
