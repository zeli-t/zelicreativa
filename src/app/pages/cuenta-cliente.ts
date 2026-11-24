import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, PendingTasks, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Autenticacion } from '../services/autenticacion';
import { CAMPOS_DIRECCION, campoDireccionValido, DatosDireccion, Direccion, Direcciones, direccionVacia } from '../services/direcciones';
import { DatosPerfil, Perfil, PerfilPropio } from '../services/perfil';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './cuenta-cliente.html',
  styleUrl: './cuenta-cliente.css',
})
export class CuentaCliente {
  private readonly auth = inject(Autenticacion);
  private readonly perfilApi = inject(Perfil);
  private readonly direccionesApi = inject(Direcciones);
  private readonly ruta = inject(ActivatedRoute);
  private readonly documento = inject(DOCUMENT);
  private readonly vida = inject(DestroyRef);
  private readonly tareas = inject(PendingTasks);
  readonly usuario = computed(() => this.auth.sesion()?.user.id);
  readonly correo = computed(() => this.auth.sesion()?.user.email ?? '');
  readonly habilitada = this.perfilApi.habilitado;
  readonly esDirecciones = this.ruta.snapshot.data['direcciones'] === true;
  readonly volverAlCheckout = this.ruta.snapshot.queryParamMap.get('volver') === 'checkout';
  readonly campos = CAMPOS_DIRECCION;
  readonly perfil = signal<PerfilPropio | null>(null);
  readonly direcciones = signal<Direccion[]>([]);
  readonly cargado = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  datosPerfil: DatosPerfil = { nombre: '', telefono: null };
  direccion: DatosDireccion | null = null;
  idEdicion: number | null = null;
  private revision = 0;

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      this.revision++;
      this.perfil.set(null);
      this.direcciones.set([]);
      this.datosPerfil = { nombre: '', telefono: null };
      this.cerrarDireccion();
      this.cargado.set(false);
      this.ocupado.set(false);
      this.error.set('');
      this.aviso.set('');
      if (usuario && this.habilitada) untracked(() => this.tareas.run(() => this.cargar()));
    });
  }

  cargar(): Promise<void> {
    return this.operar('No pudimos consultar tu cuenta. Vuelve a intentarlo.', async (usuario, vigente) => {
      if (this.esDirecciones) {
        const [filas, perfil] = await Promise.all([this.direccionesApi.listar(usuario), this.perfilApi.obtener(usuario)]);
        if (!vigente()) return;
        this.direcciones.set(filas);
        this.perfil.set(perfil);
      } else {
        const perfil = await this.perfilApi.obtener(usuario);
        if (!vigente()) return;
        this.mostrarPerfil(perfil);
      }
      this.cargado.set(true);
    });
  }

  guardarPerfil(): Promise<void> {
    const nombre = this.datosPerfil.nombre.trim();
    if (!this.perfil()?.activo || !nombre || nombre.length > 100) {
      this.error.set('Escribe un nombre de 1 a 100 caracteres en una cuenta activa.');
      return Promise.resolve();
    }
    return this.operar('No pudimos confirmar el cambio en tu perfil. Consulta tus datos antes de reintentar.', async (usuario, vigente) => {
      const perfil = await this.perfilApi.guardar(usuario, this.datosPerfil);
      if (!vigente()) return;
      this.mostrarPerfil(perfil);
      this.aviso.set('Perfil actualizado.');
    });
  }

  editarDireccion(direccion?: Direccion): void {
    if (this.ocupado() || !this.perfil()?.activo) return;
    this.idEdicion = direccion?.id ?? null;
    this.direccion = direccion ? { ...direccion } : direccionVacia();
    this.error.set('');
    this.aviso.set('');
  }

  cerrarDireccion(): void {
    this.idEdicion = null;
    this.direccion = null;
  }

  guardarDireccion(): Promise<void> {
    const datos = this.direccion;
    const id = this.idEdicion;
    if (!this.perfil()?.activo || !datos || !this.campos.every(c => campoDireccionValido(datos, c.id))) {
      this.error.set('Completa los campos de la dirección y escribe un código postal de 5 dígitos.');
      return Promise.resolve();
    }
    return this.operar('No pudimos confirmar el cambio en la dirección. Actualiza la lista antes de reintentar.', async (usuario, vigente) => {
      const guardada = id === null ? await this.direccionesApi.guardar(usuario, datos)
        : await this.direccionesApi.editar(usuario, id, datos);
      if (!vigente()) return;
      this.direcciones.update(filas => id === null ? [guardada, ...filas] :
        filas.map(fila => fila.id === id ? guardada : fila));
      this.cerrarDireccion();
      this.aviso.set(id === null ? 'Dirección registrada.' : 'Dirección actualizada.');
    });
  }

  quitarDireccion(id: number): Promise<void> {
    if (!this.perfil()?.activo || this.ocupado() || this.documento.defaultView?.confirm(
      '¿Quitar esta dirección de tus opciones de entrega? Se conservará en los pedidos anteriores.',
    ) !== true) return Promise.resolve();
    return this.operar('No pudimos quitar la dirección. Actualiza la lista y vuelve a intentarlo.', async (usuario, vigente) => {
      await this.direccionesApi.quitar(usuario, id);
      if (!vigente()) return;
      this.direcciones.update(filas => filas.filter(fila => fila.id !== id));
      if (this.idEdicion === id) this.cerrarDireccion();
      this.aviso.set('Dirección retirada de tus opciones de entrega.');
    });
  }

  private mostrarPerfil(perfil: PerfilPropio): void {
    this.perfil.set(perfil);
    this.datosPerfil = { nombre: perfil.nombre, telefono: perfil.telefono };
  }

  private async operar(
    error: string, accion: (usuario: string, vigente: () => boolean) => Promise<void>,
  ): Promise<void> {
    const usuario = this.usuario();
    const revision = this.revision;
    if (!usuario || !this.habilitada || this.ocupado()) return;
    const vigente = () => !this.vida.destroyed && this.usuario() === usuario && this.revision === revision;
    this.ocupado.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      await accion(usuario, vigente);
    } catch {
      if (vigente()) this.error.set(error);
    } finally {
      if (vigente()) this.ocupado.set(false);
    }
  }
}
