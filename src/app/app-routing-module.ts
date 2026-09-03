import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Inicio } from './pages/inicio/inicio';
import { DetalleProducto } from './pages/detalle-producto/detalle-producto';
import { IniciarSesion } from './pages/iniciar-sesion/iniciar-sesion';
import { Registro } from './pages/registro/registro';
import { Carrito } from './pages/carrito/carrito';
import { Checkout } from './pages/checkout/checkout';
import { ConfirmacionPedido } from './pages/confirmacion-pedido/confirmacion-pedido';
import { ListaDeseos } from './pages/lista-deseos/lista-deseos';

const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: Inicio },
  { path: 'detalle-producto', component: DetalleProducto },
  { path: 'iniciar-sesion', component: IniciarSesion },
  { path: 'registro', component: Registro },
  { path: 'carrito', component: Carrito },
  { path: 'checkout', component: Checkout },
  { path: 'confirmacion-pedido', component: ConfirmacionPedido },
  { path: 'lista-deseos', component: ListaDeseos }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }