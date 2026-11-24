import { signal } from '@angular/core';
import type { Provider } from '@angular/core';
import { vi } from 'vitest';
import { Autenticacion } from '../services/autenticacion';
import { Catalogo } from '../services/catalogo';
import type { CategoriaCatalogo, ProductoCatalogo } from '../services/catalogo';

export function catalogoDePrueba(): Provider {
  return {
    provide: Catalogo,
    useValue: {
      contenido: signal<{ categorias: CategoriaCatalogo[]; productos: ProductoCatalogo[] }>({
        categorias: [], productos: [],
      }),
      estadoCarga: signal('listo'),
      disponibilidad: signal(new Map<number, boolean>()),
      estadoDisponibilidad: signal('listo'),
      actualizarDisponibilidad: vi.fn(async () => {}),
      error: signal(''),
      cargar: vi.fn(async () => {}),
    },
  };
}

export function autenticacionDePrueba(): Provider {
  return {
    provide: Autenticacion,
    useValue: {
      sesion: signal(null),
      iniciar: vi.fn(async () => {}),
    },
  };
}

export function instalarAlmacenamientoDePrueba(datos: Record<string, string> = {}): Storage {
  const memoria = new Map(Object.entries(datos));
  const almacenamiento: Storage = {
    get length() { return memoria.size; },
    clear: () => memoria.clear(),
    getItem: clave => memoria.get(clave) ?? null,
    key: indice => [...memoria.keys()][indice] ?? null,
    removeItem: clave => { memoria.delete(clave); },
    setItem: (clave, valor) => { memoria.set(clave, valor); },
  };
  vi.stubGlobal('localStorage', almacenamiento);
  return almacenamiento;
}
