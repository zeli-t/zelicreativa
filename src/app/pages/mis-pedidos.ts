import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, effect, inject, PendingTasks, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Autenticacion } from '../services/autenticacion';
import { mensajePedido, PedidoEnListaCliente, Pedidos } from '../services/pedidos';
import { estadoSeguimiento } from './seguimiento-reglas';

@Component({
  imports: [RouterLink, CurrencyPipe, DatePipe, TitleCasePipe],
  template: `
    <main class="container py-5">
      <h1>Mis pedidos</h1>
      @if (!pedidos.habilitado) {
        <p>Consulta tus compras simuladas desde el entorno de pruebas.</p>
      } @else if (cargando()) {
        <p role="status">Consultando tus pedidos…</p>
      } @else if (error()) {
        <p role="alert" class="text-danger">{{ error() }}</p>
        <button type="button" class="btn btn-outline-secondary" (click)="reintentar()">Reintentar</button>
      } @else if (!filas().length) {
        <p>{{ pagina() === 0 ? 'Aún no tienes pedidos registrados.' : 'No hay más pedidos en esta página.' }}</p>
      } @else {
        <ul class="list-group my-3">
          @for (pedido of filas(); track pedido.id) {
            <li class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
              <div class="text-break">
                <strong>{{ pedido.folio }}</strong>
                <div>{{ pedido.creado_en | date:'dd/MM/yyyy' }} · {{ pedido.total | currency:'MXN':'code' }}
                  <span class="estado-pedido ms-2">{{ estadoSeguimiento(pedido) | titlecase }}</span>
                </div>
              </div>
              <a class="btn btn-outline-dark" routerLink="/confirmacion-pedido" [queryParams]="{ folio: pedido.folio }">
                Ver seguimiento
              </a>
            </li>
          }
        </ul>
      }
      @if (pedidos.habilitado) {
        <div class="d-flex gap-2">
          @if (pagina() > 0) {
            <button type="button" class="btn btn-outline-secondary" [disabled]="cargando()" (click)="mover(-1)">Anterior</button>
          }
          @if (hayMas()) {
            <button type="button" class="btn btn-outline-secondary" [disabled]="cargando()" (click)="mover(1)">Siguiente</button>
          }
        </div>
      }
      <a class="btn btn-dark mt-3" routerLink="/catalogo">Ir al catálogo</a>
    </main>
  `,
  styles: [`.estado-pedido { display: inline-block; border-radius: 1rem; padding: .15rem .6rem;
    background: var(--zeli-pink); color: var(--zeli-berry); font-weight: 600; }`],
})
export class MisPedidos {
  readonly pedidos = inject(Pedidos);
  private readonly auth = inject(Autenticacion);
  private readonly tareas = inject(PendingTasks);
  private readonly usuario = computed(() => this.auth.sesion()?.user.id);
  private readonly reintento = signal(0);
  private readonly tamano = 20;
  readonly pagina = signal(0);
  readonly filas = signal<PedidoEnListaCliente[]>([]);
  readonly estadoSeguimiento = estadoSeguimiento;
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly hayMas = signal(false);

  constructor() {
    effect(limpiar => {
      this.reintento();
      const usuario = this.usuario();
      const pagina = this.pagina();
      this.filas.set([]);
      this.hayMas.set(false);
      this.error.set('');
      this.cargando.set(false);
      if (!usuario || !this.pedidos.habilitado) return;
      let vigente = true;
      limpiar(() => { vigente = false; });
      this.cargando.set(true);
      this.tareas.run(async () => {
        try {
          const filas = await this.pedidos.listarPropios(usuario, pagina, this.tamano);
          if (!vigente || this.usuario() !== usuario) return;
          this.filas.set(filas.slice(0, this.tamano));
          this.hayMas.set(filas.length > this.tamano);
        } catch (error) {
          if (vigente) this.error.set(mensajePedido(error, 'No pudimos consultar tus pedidos.'));
        } finally {
          if (vigente) this.cargando.set(false);
        }
      });
    });
  }

  mover(direccion: number): void {
    this.pagina.update(pagina => Math.max(0, pagina + direccion));
  }

  reintentar(): void {
    this.reintento.update(numero => numero + 1);
  }
}
