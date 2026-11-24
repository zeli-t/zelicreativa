import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { autenticacionDePrueba } from '../../testing/entorno-pruebas';
import { Registro } from './registro';

describe('Registro', () => {
  let fixture: ComponentFixture<Registro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Registro],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([]), autenticacionDePrueba()],
    }).compileComponents();

    fixture = TestBed.createComponent(Registro);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
