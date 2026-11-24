import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Autenticacion, correoValido, mensajeAuth } from '../../services/autenticacion';

@Component({
  selector: 'app-registro',
  standalone: false,
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly auth = inject(Autenticacion);
  private readonly router = inject(Router);

  nombre = '';
  correo = '';
  password = '';
  confirmarPassword = '';
  enviado = false;

  readonly pendiente = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  get emailValido(): boolean { return correoValido(this.correo); }

  async registrar(): Promise<void> {
    if (this.pendiente()) return;
    this.enviado = true;
    this.error.set('');
    this.aviso.set('');
    if (!this.nombre.trim() || !this.emailValido ||
        this.password.length < 6 || this.password !== this.confirmarPassword) return;

    this.pendiente.set(true);
    try {
      const { user, session } = await this.auth.registrar(this.nombre.trim(), this.correo.trim(), this.password);
      this.password = '';
      this.confirmarPassword = '';
      this.enviado = false;
      if (session) {
        await this.router.navigate(['/inicio']);
      } else if (user?.identities?.length === 0) {
        this.aviso.set('Revisa tu bandeja de entrada. Si ya tienes una cuenta con ese correo, puedes iniciar sesión.');
      } else {
        this.aviso.set('Revisa tu correo y abre el enlace de confirmación para activar tu cuenta.');
      }
    } catch (error) {
      this.error.set(mensajeAuth(error, 'No pudimos crear la cuenta. Intenta nuevamente.'));
    } finally {
      this.pendiente.set(false);
    }
  }
}
