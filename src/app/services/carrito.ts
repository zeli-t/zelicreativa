import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Carrito {

  private LIMITE_INVENTARIO = 10;

  private productos = new BehaviorSubject<any[]>(
    this.cargarCarrito()
  );

  carrito$ = this.productos.asObservable();

  agregarProducto(producto: any) {

    const carrito = this.productos.value;

    const productoExistente = carrito.find(
      p => p.nombre === producto.nombre
    );

    if (productoExistente) {

      if (productoExistente.cantidad >= this.LIMITE_INVENTARIO) {

        alert('No hay más unidades disponibles de este producto.');

        return;
      }

      productoExistente.cantidad++;

    } else {

      carrito.push({
        ...producto,
        cantidad: 1
      });

    }

    this.productos.next(carrito);
    this.guardarCarrito(carrito);
  }

  aumentarCantidad(nombre: string) {

    const carrito = this.productos.value;

    const producto = carrito.find(
      p => p.nombre === nombre
    );

    if (producto) {

      if (producto.cantidad >= this.LIMITE_INVENTARIO) {

        alert('Has alcanzado el límite de inventario disponible.');

        return;
      }

      producto.cantidad++;

    }

    this.productos.next(carrito);
    this.guardarCarrito(carrito);
  }

  disminuirCantidad(nombre: string) {

    const carrito = this.productos.value;

    const producto = carrito.find(
      p => p.nombre === nombre
    );

    if (producto) {

      if (producto.cantidad > 1) {

        producto.cantidad--;

      } else {

        this.eliminarProducto(nombre);

        return;
      }

    }

    this.productos.next(carrito);
    this.guardarCarrito(carrito);
  }

  eliminarProducto(nombre: string) {

    const carrito = this.productos.value.filter(
      p => p.nombre !== nombre
    );

    this.productos.next(carrito);
    this.guardarCarrito(carrito);
  }

  vaciarCarrito() {

    this.productos.next([]);
    this.guardarCarrito([]);

  }

  obtenerCantidad(): number {

    return this.productos.value.reduce(
      (total, producto) => total + producto.cantidad,
      0
    );

  }

  obtenerSubtotal(): number {

    return this.productos.value.reduce(
      (total, producto) =>
        total + (producto.precio * producto.cantidad),
      0
    );

  }

  private guardarCarrito(carrito: any[]) {

    localStorage.setItem(
      'carritoZeli',
      JSON.stringify(carrito)
    );

  }

  private cargarCarrito(): any[] {

    const carritoGuardado =
      localStorage.getItem('carritoZeli');

    return carritoGuardado
      ? JSON.parse(carritoGuardado)
      : [];

  }

}