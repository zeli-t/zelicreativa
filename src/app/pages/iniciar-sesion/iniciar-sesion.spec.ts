import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { autenticacionDePrueba } from '../../testing/entorno-pruebas';
import { IniciarSesion } from './iniciar-sesion';

describe('IniciarSesion', () => {
  let fixture: ComponentFixture<IniciarSesion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IniciarSesion],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([]), autenticacionDePrueba()],
    }).compileComponents();

    fixture = TestBed.createComponent(IniciarSesion);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
