import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-iniciar-sesion',
  standalone: false,
  templateUrl: './iniciar-sesion.html',
  styleUrl: './iniciar-sesion.css'
})
export class IniciarSesion {

  correo = '';
  password = '';

  constructor(private router: Router) {}

  iniciarSesion() {

    const datos = localStorage.getItem('usuarioZeli');

    if (!datos) {
      alert('No existe una cuenta. Regístrate primero.');
      return;
    }

    const usuario = JSON.parse(datos);

    if (
      this.correo === usuario.correo &&
      this.password === usuario.password
    ) {

      localStorage.setItem('sesionZeli', 'true');

      alert('Bienvenida a Zeli Creativa 💕');

      this.router.navigate(['/inicio']);

    } else {

      alert('Correo o contraseña incorrectos');

    }

  }

}