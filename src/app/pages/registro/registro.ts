import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro',
  standalone: false,
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro {

  nombre = '';
  correo = '';
  password = '';
  confirmarPassword = '';

  enviado = false;

  constructor(private router: Router) {}

  registrar() {

    this.enviado = true;

    if (
      !this.nombre ||
      !this.correo ||
      !this.password ||
      !this.confirmarPassword
    ) {
      return;
    }

    if (this.password !== this.confirmarPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (this.password.length < 6) {
      alert('La contraseña debe tener mínimo 6 caracteres');
      return;
    }

    const usuario = {
      nombre: this.nombre,
      correo: this.correo,
      password: this.password
    };

    localStorage.setItem(
      'usuarioZeli',
      JSON.stringify(usuario)
    );

    alert('Cuenta creada correctamente 💕');

    this.router.navigate(['/iniciar-sesion']);

  }

}