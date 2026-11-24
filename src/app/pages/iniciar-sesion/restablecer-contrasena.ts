import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Autenticacion, mensajeAuth } from '../../services/autenticacion';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './restablecer-contrasena.html',
})
export class RestablecerContrasena implements OnInit {
  readonly auth = inject(Autenticacion);
  private readonly router = inject(Router);
  readonly verificando = signal(true);
  readonly pendiente = signal(false);
  readonly actualizada = signal(false);
  readonly sesionCerrada = signal(false);
  readonly error = signal('');
  password = '';
  confirmacion = '';

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.iniciar();
    } catch {
      this.error.set('No pudimos verificar el enlace de recuperación.');
    } finally {
      this.verificando.set(false);
    }
  }

  async guardar(): Promise<void> {
    if (this.pendiente() || !this.auth.puedeRestablecer() || this.actualizada()) return;
    this.error.set('');
    if (this.password.length < 8) {
      this.error.set('Usa al menos 8 caracteres para la nueva contraseña.');
      return;
    }
    if (this.password !== this.confirmacion) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.pendiente.set(true);
    try {
      await this.auth.restablecerContrasena(this.password);
      this.password = '';
      this.confirmacion = '';
      this.actualizada.set(true);
      await this.cerrarRecuperacion();
    } catch (error) {
      this.error.set(error instanceof Error && error.message === 'RECUPERACION_REQUERIDA'
        ? 'La sesión de recuperación caducó. Solicita otro enlace.'
        : mensajeAuth(error, 'No pudimos cambiar la contraseña. Intenta nuevamente.'));
    } finally {
      this.pendiente.set(false);
    }
  }

  async cerrarRecuperacion(): Promise<void> {
    this.error.set('');
    try {
      await this.auth.salir();
      this.sesionCerrada.set(true);
      if (!this.actualizada()) await this.router.navigate(['/iniciar-sesion']);
    } catch {
      this.error.set('No pudimos cerrar la sesión de recuperación. Intenta de nuevo.');
    }
  }
}
