import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Autenticacion, correoValido, mensajeAuth } from '../../services/autenticacion';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './recuperar-contrasena.html',
})
export class RecuperarContrasena {
  private readonly auth = inject(Autenticacion);
  correo = '';
  readonly pendiente = signal(false);
  readonly enviado = signal(false);
  readonly error = signal('');

  async enviar(): Promise<void> {
    if (this.pendiente()) return;
    this.error.set('');
    this.enviado.set(false);
    if (!correoValido(this.correo)) {
      this.error.set('Escribe un correo electrónico válido.');
      return;
    }
    this.pendiente.set(true);
    try {
      await this.auth.solicitarRecuperacion(this.correo.trim());
      this.enviado.set(true);
    } catch (error) {
      this.error.set(mensajeAuth(error, 'No pudimos enviar la solicitud. Intenta nuevamente.'));
    } finally {
      this.pendiente.set(false);
    }
  }
}
