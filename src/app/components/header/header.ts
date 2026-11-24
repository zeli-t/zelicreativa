import { Component, OnInit, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { Carrito } from '../../services/carrito';
import { Catalogo } from '../../services/catalogo';
import { Autenticacion } from '../../services/autenticacion';
import { Administracion } from '../../services/administracion';
import { Perfil } from '../../services/perfil';
import { CierreSesion } from '../../services/cierre-sesion';

@Component({
  selector: 'app-header',
  standalone: false,
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header implements OnInit {
  private readonly router = inject(Router);
  private readonly catalogo = inject(Catalogo);
  readonly auth = inject(Autenticacion);
  readonly admin = inject(Administracion);
  private readonly perfil = inject(Perfil);
  private readonly usuario = computed(() => this.auth.sesion()?.user.id);
  readonly nombreCuenta = computed(() => {
    const guardado = this.perfil.nombre();
    const datos = this.auth.sesion()?.user.user_metadata;
    const nombre = datos?.['nombre'] ?? datos?.['full_name'] ?? datos?.['name'];
    const nombreAuth = typeof nombre === 'string' ? nombre.trim() : '';
    return guardado && guardado !== 'Cliente' ? guardado : nombreAuth || guardado || '';
  });
  readonly cierreSesion = inject(CierreSesion);
  readonly cantidadCarrito = toSignal(inject(Carrito).carrito$.pipe(
    map(productos => productos.reduce((total, producto) => total + producto.cantidad, 0)),
  ), { initialValue: 0 });
  carritoAbierto = false;
  busqueda = '';
  private mostrarSugerencias = false;

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      untracked(() => void this.admin.comprobarRol().catch(() => {}));
      if (usuario && this.perfil.habilitado) untracked(() => void this.perfil.obtener(usuario).catch(() => {}));
    });
  }

  ngOnInit(): void {
    void this.catalogo.cargar();
    void this.auth.iniciar().catch(() => {});
  }

  get sugerencias(): string[] {
    const texto = this.busqueda.trim().toLocaleLowerCase('es');
    if (!texto || !this.mostrarSugerencias) return [];

    return [...new Set(this.catalogo.contenido().productos
      .filter(producto => producto.nombre.toLocaleLowerCase('es').includes(texto))
      .map(producto => producto.nombre))].slice(0, 5);
  }

  buscar(): void { this.mostrarSugerencias = true; }
  ocultarSugerencias(): void { this.mostrarSugerencias = false; }

  alSalirDelBuscador(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.ocultarSugerencias();
    }
  }

  seleccionarSugerencia(producto: string): void {
    this.busqueda = producto;
    this.realizarBusqueda();
  }

  realizarBusqueda(): void {
    this.ocultarSugerencias();
    void this.router.navigate(['/catalogo'], { queryParams: { buscar: this.busqueda.trim() || null } });
  }

  abrirCarrito(): void { this.carritoAbierto = !this.carritoAbierto; }
  cerrarCarrito(): void { this.carritoAbierto = false; }

  cerrarMenu(cuenta: HTMLDetailsElement, devolverFoco = false): void {
    cuenta.open = false;
    if (devolverFoco) cuenta.querySelector('summary')?.focus();
  }

  alSalirDelMenu(evento: FocusEvent, cuenta: HTMLDetailsElement): void {
    if (this.cierreSesion.pendiente()) return;
    if (!cuenta.contains(evento.relatedTarget as Node | null)) this.cerrarMenu(cuenta);
  }

}
