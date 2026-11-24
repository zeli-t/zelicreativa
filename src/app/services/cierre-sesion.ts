import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Autenticacion, mensajeAuth } from './autenticacion';

@Injectable({ providedIn: 'root' })
export class CierreSesion {
  private readonly auth = inject(Autenticacion);
  private readonly router = inject(Router);
  private temporizador?: ReturnType<typeof setTimeout>;
  readonly pendiente = signal(false);
  readonly confirmado = signal(false);
  readonly error = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limpiarTemporizador());
  }

  async salir(): Promise<void> {
    if (this.pendiente() || this.confirmado() || !this.auth.sesion()) return;
    this.error.set('');
    this.pendiente.set(true);
    try {
      await this.auth.salir();
      this.confirmado.set(true);
      this.temporizador = setTimeout(() => void this.irAlInicio(), 2000);
    } catch (error) {
      this.error.set(mensajeAuth(error, 'No pudimos cerrar la sesión. Vuelve a intentarlo.'));
    } finally {
      this.pendiente.set(false);
    }
  }

  async irAlInicio(): Promise<void> {
    this.limpiarTemporizador();
    try {
      if (this.router.url !== '/inicio') {
        await this.router.navigate(['/inicio'], { replaceUrl: true });
      }
      this.error.set('');
    } catch {
      this.error.set('La sesión se cerró. Puedes volver al inicio desde el menú.');
    } finally {
      this.confirmado.set(false);
    }
  }

  private limpiarTemporizador(): void {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
  }
}
