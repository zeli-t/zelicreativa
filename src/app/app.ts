import { Component, inject, signal } from '@angular/core';
import { CierreSesion } from './services/cierre-sesion';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('papevirtual');
  readonly cierreSesion = inject(CierreSesion);
}
