import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthError, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Autenticacion {
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly sesionActual = signal<Session | null>(null);
  private readonly sesionRecuperacion = signal<Session | null>(null);
  private readonly recuperacionPendiente = signal(this.leerMarcaRecuperacion());
  readonly sesion = computed(() => this.recuperacionPendiente() ? null : this.sesionActual());
  readonly puedeRestablecer = computed(() => {
    const actual = this.sesionActual();
    return !!actual && actual.access_token === this.sesionRecuperacion()?.access_token;
  });

  private cliente?: ReturnType<Autenticacion['crearCliente']>;
  private restauracion?: Promise<void>;

  iniciar(): Promise<void> {
    return this.restauracion ??= this.restaurar().catch(error => {
      this.restauracion = undefined;
      throw error;
    });
  }

  private async restaurar(): Promise<void> {
    const ventana = this.documento.defaultView;
    const url = new URL(ventana?.location.href ?? this.documento.baseURI);
    const fragmento = new URLSearchParams(url.hash.slice(1));
    const destino = new URL('restablecer-contrasena', this.documento.baseURI);
    const esRecuperacion = url.pathname === destino.pathname ||
      url.searchParams.get('type') === 'recovery' || fragmento.get('type') === 'recovery';
    const cliente = await this.obtenerCliente();
    const inicializacion = await cliente.auth.initialize();
    if (esRecuperacion) {
      const hash = url.searchParams.get('token_hash');
      const codigo = url.searchParams.get('code');
      if (hash && url.searchParams.get('type') === 'recovery') {
        await cliente.auth.verifyOtp({ token_hash: hash, type: 'recovery' });
      } else if (codigo && inicializacion.error) {
        // La sesión solo se habilita si el SDK reconoce el verificador como recuperación.
        await cliente.auth.exchangeCodeForSession(codigo);
      }
    }
    const { data, error } = await cliente.auth.getSession();
    if (error) throw error;
    this.sesionActual.set(data.session);
    // El SDK difiere la notificación de los enlaces que procesa al inicializar.
    await new Promise<void>(resolver => setTimeout(resolver, 0));
    if (esRecuperacion && ventana) {
      const limpia = new URL(ventana.location.href);
      for (const nombre of ['token_hash', 'code', 'type', 'error', 'error_code', 'error_description']) {
        limpia.searchParams.delete(nombre);
      }
      limpia.hash = '';
      ventana.history.replaceState(ventana.history.state, '', limpia.href);
      if (this.puedeRestablecer() && url.pathname !== destino.pathname) {
        void this.router.navigate(['/restablecer-contrasena'], { replaceUrl: true });
      }
    }
    if (this.recuperacionPendiente() && !this.sesionRecuperacion()) {
      await this.salir();
    }
  }

  private obtenerCliente() {
    return this.cliente ??= this.crearCliente().catch(error => {
      this.cliente = undefined;
      throw error;
    });
  }

  private async crearCliente() {
    const { url, clave } = validarConfiguracionAuth(environment);
    // Retira las credenciales del prototipo y conserva carrito y favoritos.
    try {
      const almacenamiento = this.documento.defaultView?.localStorage;
      almacenamiento?.removeItem('usuarioZeli');
      almacenamiento?.removeItem('sesionZeli');
    } catch {
      // El navegador puede bloquear el acceso al almacenamiento.
    }
    const { createClient } = await import('@supabase/supabase-js');
    const cliente = createClient(url, clave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    cliente.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY' && sesion) {
        this.marcarRecuperacion(true);
        this.sesionRecuperacion.set(sesion);
      } else if (evento === 'SIGNED_OUT') {
        this.sesionRecuperacion.set(null);
        this.marcarRecuperacion(false);
      } else if (sesion && this.sesionRecuperacion()?.user.id !== sesion.user.id) {
        this.sesionRecuperacion.set(null);
      }
      this.sesionActual.set(sesion);
    });
    return cliente;
  }

  private leerMarcaRecuperacion(): boolean {
    try {
      return this.documento.defaultView?.sessionStorage.getItem('zeli-recuperacion') === '1';
    } catch {
      return false;
    }
  }

  private marcarRecuperacion(activa: boolean): void {
    this.recuperacionPendiente.set(activa);
    try {
      const almacenamiento = this.documento.defaultView?.sessionStorage;
      if (activa) almacenamiento?.setItem('zeli-recuperacion', '1');
      else almacenamiento?.removeItem('zeli-recuperacion');
    } catch {
      // La marca no contiene datos de cuenta ni credenciales.
    }
  }

  async solicitarRecuperacion(correo: string): Promise<void> {
    const cliente = await this.obtenerCliente();
    const { error } = await cliente.auth.resetPasswordForEmail(correo, {
      redirectTo: new URL('restablecer-contrasena', this.documento.baseURI).href,
    });
    if (error && error.code !== 'user_not_found') throw error;
  }

  async restablecerContrasena(password: string): Promise<void> {
    const cliente = await this.obtenerCliente();
    const sesion = this.sesionRecuperacion();
    const { data, error: errorSesion } = await cliente.auth.getSession();
    if (errorSesion) throw errorSesion;
    if (!sesion || !this.puedeRestablecer() || data.session?.access_token !== sesion.access_token ||
        !sesion.expires_at || sesion.expires_at <= Date.now() / 1000) {
      throw new Error('RECUPERACION_REQUERIDA');
    }
    const { error } = await cliente.auth.updateUser({ password });
    if (error) throw error;
    this.sesionRecuperacion.set(null);
  }

  async registrar(nombre: string, correo: string, password: string) {
    const cliente = await this.obtenerCliente();
    const { data, error } = await cliente.auth.signUp({
      email: correo,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: new URL('iniciar-sesion', this.documento.baseURI).href,
      },
    });
    if (error) throw error;
    return data;
  }

  async ingresar(correo: string, password: string): Promise<void> {
    const cliente = await this.obtenerCliente();
    const { error } = await cliente.auth.signInWithPassword({ email: correo, password });
    if (error) throw error;
    this.sesionRecuperacion.set(null);
    this.marcarRecuperacion(false);
  }

  async salir(): Promise<void> {
    const cliente = await this.obtenerCliente();
    const { error } = await cliente.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.sesionActual.set(null);
    this.sesionRecuperacion.set(null);
    this.marcarRecuperacion(false);
  }
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

class ErrorConfiguracionAuth extends Error {
  constructor(readonly code: string) {
    super('Configuración de autenticación inválida.');
  }
}

export function validarConfiguracionAuth(configuracion: {
  supabaseUrl: string;
  supabasePublishableKey: string;
  checkoutSimulado: boolean;
}): { url: string; clave: string } {
  const url = configuracion.supabaseUrl.trim();
  const clave = configuracion.supabasePublishableKey.trim();
  if (!url || !clave) {
    throw new ErrorConfiguracionAuth(configuracion.checkoutSimulado ? 'config_checkout_incompleta' : 'config_auth_incompleta');
  }

  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new ErrorConfiguracionAuth('config_auth_url');
  }
  if (destino.protocol !== 'https:' || destino.username || destino.password ||
      destino.pathname !== '/' || destino.search || destino.hash ||
      (configuracion.checkoutSimulado && !/^[a-z0-9]{20}\.supabase\.co$/.test(destino.host))) {
    throw new ErrorConfiguracionAuth('config_auth_url');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(clave)) {
    throw new ErrorConfiguracionAuth('config_auth_clave');
  }
  return { url: destino.origin, clave };
}

export function mensajeAuth(error: unknown, alternativo: string): string {
  const { code, name, status } = (error ?? {}) as Partial<AuthError>;
  switch (code) {
    case 'config_checkout_incompleta':
      return 'Falta la URL o la clave publicable de zeli-creativa-test. Completa environment.checkout-test.ts y reinicia Angular.';
    case 'config_auth_incompleta':
      return 'Falta configurar la URL o la clave publicable de Supabase para este entorno.';
    case 'config_auth_url':
      return 'La URL de Supabase no es válida. Usa la URL HTTPS base que aparece en el panel del proyecto.';
    case 'config_auth_clave':
      return 'Configura una clave publicable del proyecto que empiece por sb_publishable_.';
    case 'invalid_api_key':
      return 'Supabase rechazó la clave de la aplicación. Comprueba que la URL y la clave publicable sean del mismo proyecto.';
    case 'email_address_not_authorized':
      return 'El servicio de correo de este proyecto no puede enviar el enlace a esa dirección.';
    case 'email_provider_disabled':
      return 'Este proyecto no tiene habilitada la autenticación por correo.';
    case 'bad_jwt':
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'La sesión guardada ya no es válida. Vuelve a iniciar sesión.';
    case 'captcha_failed':
      return 'Supabase rechazó la verificación de seguridad. Revisa la configuración de CAPTCHA del proyecto.';
    case 'user_already_exists':
    case 'email_exists': return 'Ese correo ya está registrado. Puedes iniciar sesión.';
    case 'email_not_confirmed': return 'Confirma tu correo antes de iniciar sesión.';
    case 'invalid_credentials': return 'El correo o la contraseña son incorrectos.';
    case 'weak_password': return 'La contraseña no cumple los requisitos de seguridad.';
    case 'email_address_invalid':
    case 'validation_failed': return 'Revisa el correo y los datos introducidos.';
  }
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Hubo demasiados intentos. Espera un momento y vuelve a intentarlo.';
  }
  if (name === 'AuthSessionMissingError') return 'La sesión ya no está disponible. Vuelve a iniciar sesión.';
  if (status === 401) return 'Supabase rechazó la autenticación de la aplicación o la sesión. Comprueba el proyecto y vuelve a iniciar sesión.';
  if (status === 403) return 'Supabase no permite esta operación con la configuración actual del proyecto.';
  if (status !== undefined && status >= 500) return 'El servicio de autenticación no pudo procesar la solicitud. Intenta más tarde.';
  if (name === 'AuthRetryableFetchError' || name === 'TypeError' || status === 0) {
    return 'No pudimos conectar con Supabase. Revisa tu conexión y vuelve a intentarlo.';
  }
  return alternativo;
}
