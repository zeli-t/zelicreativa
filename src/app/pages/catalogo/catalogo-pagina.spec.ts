import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { Catalogo, ProductoCatalogo } from '../../services/catalogo';
import { CatalogoPagina } from './catalogo-pagina';

describe('Paginación y disponibilidad del catálogo', () => {
  it('pagina después de filtrar y vuelve a la primera página al cambiar el filtro', async () => {
    const productos = Array.from({ length: 15 }, (_, indice): ProductoCatalogo => ({
      id: indice + 1, slug: 'libreta-' + (indice + 1), nombre: 'Libreta ' + (indice + 1),
      descripcion: '', precio: 15, precioAnterior: 0, oferta: false, imagen: 'libreta.jpg', categoriaId: 1,
      variantes: [{ id: indice + 1, sku: 'LIB-' + (indice + 1), nombre: 'Rosa', precioAdicional: 0, predeterminada: true }],
    }));
    const stock = new Map(productos.slice(0, 14).map(p => [p.id, p.id <= 13]));
    await TestBed.configureTestingModule({
      declarations: [CatalogoPagina],
      imports: [FormsModule, RouterModule],
      providers: [
        provideRouter([]),
        { provide: Catalogo, useValue: {
          contenido: signal({ categorias: [], productos }),
          disponibilidad: signal(stock),
          estadoCarga: signal('listo'),
          estadoDisponibilidad: signal('listo'),
          cargar: async () => {},
          actualizarDisponibilidad: async () => {},
        } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogoPagina);
    fixture.detectChanges();
    const vista = fixture.componentInstance;

    expect(vista.visibles().length).toBe(12);
    vista.moverPagina(1);
    expect(vista.visibles().map(p => p.id)).toEqual([13, 14, 15]);
    vista.filtroStock.set('disponibles');
    expect(vista.pagina()).toBe(1);
    expect(vista.productos().length).toBe(13);
    vista.filtroStock.set('agotados');
    expect(vista.visibles().map(p => p.id)).toEqual([14]);
  });
});
