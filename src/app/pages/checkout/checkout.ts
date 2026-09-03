import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout implements OnInit {

  paso = 1;
  enviado = false;

  nombre = '';
  correo = '';
  direccion = '';
  ciudad = '';
  codigoPostal = '';
  telefono = '';

  metodoPago = 'tarjeta';

  numeroTarjeta = '';
  vencimiento = '';
  cvv = '';

  cupon = '';
  descuento = 0;

  subtotal = 0;
  impuestos = 0;
  envio = 60;
  total = 0;

  procesando = false;

  constructor(
    private carrito: Carrito,
    private router: Router
  ) {}

  ngOnInit() {

    if (localStorage.getItem('sesionZeli') !== 'true') {

      alert('Debes iniciar sesión para continuar con la compra.');

      this.router.navigate(['/iniciar-sesion']);

      return;
    }

    this.carrito.carrito$.subscribe(() => {

      this.subtotal = this.carrito.obtenerSubtotal();

      this.impuestos = this.subtotal * 0.16;

      this.calcularTotal();

    });

  }

  calcularEnvio() {

    if (/^\d{5}$/.test(this.codigoPostal)) {

      if (this.codigoPostal.startsWith('88')) {
        this.envio = 50;
      } else {
        this.envio = 60;
      }

    } else {
      this.envio = 60;
    }

    this.calcularTotal();

  }

  aplicarCupon() {

    if (this.cupon.toUpperCase() === 'PROFE100') {

      this.descuento = 100;
      alert('Cupón aplicado correctamente 🎉');

    } else {

      this.descuento = 0;
      alert('El cupón no es válido');

    }

    this.calcularTotal();

  }

  calcularTotal() {

    this.total = Math.max(
      0,
      this.subtotal +
      this.impuestos +
      this.envio -
      this.descuento
    );

  }

  siguientePaso() {

    this.enviado = true;

    if (
      !this.nombre ||
      !this.correo ||
      !this.direccion ||
      !this.ciudad ||
      !this.codigoPostal ||
      !this.telefono
    ) {

      return;

    }

    if (!/^\d{5}$/.test(this.codigoPostal)) {

      return;

    }

    this.calcularEnvio();

    this.paso = 2;

    this.enviado = false;

  }

  regresarPaso() {

    this.paso = 1;

  }

  realizarPago() {

    if (this.metodoPago === 'tarjeta') {

      if (
        !this.numeroTarjeta ||
        !this.vencimiento ||
        !this.cvv
      ) {

        alert('Completa los datos de tu tarjeta');

        return;

      }

    }

    this.procesando = true;

    const numeroPedido =
      'ZELI-' +
      Math.floor(100000 + Math.random() * 900000);

    const pedido = {

      numero: numeroPedido,
      nombre: this.nombre,
      correo: this.correo,
      direccion: this.direccion,
      ciudad: this.ciudad,
      codigoPostal: this.codigoPostal,
      telefono: this.telefono,
      metodoPago: this.metodoPago,
      subtotal: this.subtotal,
      impuestos: this.impuestos,
      envio: this.envio,
      descuento: this.descuento,
      total: this.total

    };

    localStorage.setItem(
      'pedidoZeli',
      JSON.stringify(pedido)
    );

    setTimeout(() => {

      this.router.navigate(['/confirmacion-pedido']);

    }, 2000);

  }

}