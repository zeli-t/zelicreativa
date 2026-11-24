import { Component, inject } from '@angular/core';
import { ActivatedRoute, CanActivateFn, Router, RouterLink } from '@angular/router';
import { Administracion } from '../../services/administracion';
import { Autenticacion } from '../../services/autenticacion';

export const requiereAdmin: CanActivateFn = async () => {
  const auth = inject(Autenticacion);
  const admin = inject(Administracion);
  const router = inject(Router);
  if (!admin.habilitado) return router.createUrlTree(['/acceso-admin'], { queryParams: { motivo: 'entorno' } });
  await auth.iniciar().catch(() => {});
  if (!auth.sesion()) return router.createUrlTree(['/iniciar-sesion'], { queryParams: { volver: 'admin' } });
  try {
    return await admin.comprobarRol() || router.createUrlTree(['/acceso-admin']);
  } catch {
    return router.createUrlTree(['/acceso-admin'], { queryParams: { motivo: 'conexion' } });
  }
};

@Component({
  imports: [RouterLink],
  template: `
    <main class="container py-5">
      <h1>Acceso a Administración</h1>
      <p role="status">{{ mensaje }}</p>
      <a class="btn btn-outline-dark" routerLink="/inicio">Volver a la tienda</a>
    </main>
  `,
})
export class AccesoAdmin {
  private readonly motivo = inject(ActivatedRoute).snapshot.queryParamMap.get('motivo');
  readonly mensaje = this.motivo === 'entorno' ? 'Administración está disponible en el perfil de pruebas.'
    : this.motivo === 'conexion' ? 'No pudimos verificar el rol en Supabase. Comprueba la conexión y vuelve a intentar.'
    : 'Tu cuenta no tiene permiso para acceder al panel administrativo.';
}
