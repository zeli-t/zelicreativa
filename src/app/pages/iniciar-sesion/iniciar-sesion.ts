import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Autenticacion, correoValido, mensajeAuth } from '../../services/autenticacion';
import { CierreSesion } from '../../services/cierre-sesion';

@Component({
  selector: 'app-iniciar-sesion',
  standalone: false,
  templateUrl: './iniciar-sesion.html',
  styleUrl: './iniciar-sesion.css',
})
export class IniciarSesion {
  readonly auth = inject(Autenticacion);
  readonly cierreSesion = inject(CierreSesion);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly volverAlCheckout = this.route.snapshot.queryParamMap.get('volver') === 'checkout';
  readonly enlaceInvalido = new URLSearchParams(this.route.snapshot.fragment ?? '').has('error_code') ||
    this.route.snapshot.queryParamMap.has('error_code');

  correo = '';
  password = '';
  readonly pendiente = signal(false);
  readonly error = signal('');

  async iniciarSesion(): Promise<void> {
    if (this.pendiente()) return;
    this.error.set('');
    if (!correoValido(this.correo) || !this.password) {
      this.error.set('Escribe un correo válido y tu contraseña.');
      return;
    }

    this.pendiente.set(true);
    try {
      await this.auth.ingresar(this.correo.trim(), this.password);
      this.password = '';
      await this.continuar();
    } catch (error) {
      this.error.set(mensajeAuth(error, 'No pudimos iniciar sesión. Intenta nuevamente.'));
    } finally {
      this.pendiente.set(false);
    }
  }

  continuar(): Promise<boolean> {
    const volver = this.route.snapshot.queryParamMap.get('volver');
    if (volver === 'mi-cuenta' || volver === 'mis-direcciones') {
      return this.router.navigate(['/' + volver]);
    }
    if (this.route.snapshot.queryParamMap.get('volver') === 'admin') {
      return this.router.navigate(['/admin']);
    }
    if (this.route.snapshot.queryParamMap.get('volver') === 'mis-pedidos') {
      return this.router.navigate(['/mis-pedidos']);
    }
    if (this.route.snapshot.queryParamMap.get('volver') === 'confirmacion-pedido') {
      return this.router.navigate(['/confirmacion-pedido'], {
        queryParams: { folio: this.route.snapshot.queryParamMap.get('folio') },
      });
    }
    return this.router.navigate([this.volverAlCheckout ? '/checkout' : '/inicio']);
  }

}
