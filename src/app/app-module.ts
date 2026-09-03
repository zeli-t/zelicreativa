import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Header } from './components/header/header';
import { Navbar } from './components/navbar/navbar';
import { Hero } from './components/hero/hero';
import { Content } from './components/content/content';
import { Footer } from './components/footer/footer';
import { CardProducto } from './components/card-producto/card-producto';
import { CardCategoria } from './components/card-categoria/card-categoria';
import { QuickView } from './components/quick-view/quick-view';
import { CarritoLateral } from './components/carrito-lateral/carrito-lateral';
import { Inicio } from './pages/inicio/inicio';
import { DetalleProducto } from './pages/detalle-producto/detalle-producto';
import { IniciarSesion } from './pages/iniciar-sesion/iniciar-sesion';
import { Registro } from './pages/registro/registro';
import { Carrito } from './pages/carrito/carrito';
import { Checkout } from './pages/checkout/checkout';
import { ConfirmacionPedido } from './pages/confirmacion-pedido/confirmacion-pedido';
import { FormsModule } from '@angular/forms';
import { ListaDeseos } from './pages/lista-deseos/lista-deseos';


@NgModule({
  declarations: [
    App,
    Header,
    Navbar,
    Hero,
    Content,
    Footer,
    CardProducto,
    CardCategoria,
    QuickView,
    CarritoLateral,
    Inicio,
    DetalleProducto,
    IniciarSesion,
    Registro,
    Carrito,
    Checkout,
    ConfirmacionPedido,
    ListaDeseos,
    
  ],
  imports: [BrowserModule, FormsModule, AppRoutingModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
