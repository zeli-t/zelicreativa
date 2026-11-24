import { NgModule, inject } from '@angular/core';
import { CanActivateFn, Router, RouterModule, Routes } from '@angular/router';
import { Autenticacion } from './services/autenticacion';

import { Inicio } from './pages/inicio/inicio';
import { CatalogoPagina } from './pages/catalogo/catalogo-pagina';
import { DetalleProducto } from './pages/detalle-producto/detalle-producto';
import { IniciarSesion } from './pages/iniciar-sesion/iniciar-sesion';
import { Registro } from './pages/registro/registro';
import { Carrito } from './pages/carrito/carrito';
import { Checkout } from './pages/checkout/checkout';
import { ConfirmacionPedido } from './pages/confirmacion-pedido/confirmacion-pedido';
import { ListaDeseos } from './pages/lista-deseos/lista-deseos';
import { AccesoAdmin, requiereAdmin } from './pages/admin/acceso-admin';

const requiereSesionCompra: CanActivateFn = async route => {
  const auth = inject(Autenticacion);
  const router = inject(Router);
  await auth.iniciar().catch(() => {});
  return auth.sesion() ? true : router.createUrlTree(['/iniciar-sesion'], {
    queryParams: { volver: route.routeConfig?.path, folio: route.queryParamMap.get('folio') },
  });
};

const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: Inicio },
  { path: 'catalogo', component: CatalogoPagina },
  { path: 'categoria/:slug', component: CatalogoPagina },
  { path: 'detalle-producto', component: DetalleProducto },
  { path: 'iniciar-sesion', component: IniciarSesion },
  {
    path: 'recuperar-contrasena',
    loadComponent: () => import('./pages/iniciar-sesion/recuperar-contrasena').then(m => m.RecuperarContrasena),
  },
  {
    path: 'restablecer-contrasena',
    loadComponent: () => import('./pages/iniciar-sesion/restablecer-contrasena').then(m => m.RestablecerContrasena),
  },
  { path: 'registro', component: Registro },
  { path: 'carrito', component: Carrito },
  {
    path: 'checkout', component: Checkout,
    canActivate: [requiereSesionCompra],
  },
  { path: 'confirmacion-pedido', component: ConfirmacionPedido, canActivate: [requiereSesionCompra] },
  {
    path: 'mi-cuenta',
    canActivate: [requiereSesionCompra],
    loadComponent: () => import('./pages/cuenta-cliente').then(m => m.CuentaCliente),
  },
  {
    path: 'mis-direcciones',
    data: { direcciones: true },
    canActivate: [requiereSesionCompra],
    loadComponent: () => import('./pages/cuenta-cliente').then(m => m.CuentaCliente),
  },
  {
    path: 'mis-pedidos',
    canActivate: [requiereSesionCompra],
    loadComponent: () => import('./pages/mis-pedidos').then(m => m.MisPedidos),
  },
  ...[
    { path: 'terminos', documento: 'terminos', titulo: 'Términos y condiciones' },
    { path: 'privacidad', documento: 'privacidad', titulo: 'Aviso de privacidad de la demostración' },
    { path: 'cambios-y-devoluciones', documento: 'devoluciones', titulo: 'Cambios y devoluciones' },
    { path: 'envios', documento: 'envios', titulo: 'Envíos' },
    { path: 'contacto', documento: 'contacto', titulo: 'Contacto' },
  ].map(({ path, ...data }) => ({
    path, data, loadComponent: () => import('./pages/condiciones-compra').then(m => m.CondicionesCompra),
  })),
  { path: 'lista-deseos', component: ListaDeseos },
  { path: 'acceso-admin', component: AccesoAdmin },
  {
    path: 'admin',
    canActivate: [requiereAdmin],
    loadComponent: () => import('./pages/admin/admin').then(modulo => modulo.Admin),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
