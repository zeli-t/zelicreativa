import { mensajeAuth, validarConfiguracionAuth } from './autenticacion';

describe('Configuración de Supabase Auth', () => {
  const configuracion = {
    checkoutSimulado: true,
    supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
    supabasePublishableKey: 'sb_publishable_prueba',
  };

  it('identifica un perfil checkout-test sin configurar', () => {
    let error: unknown;
    try {
      validarConfiguracionAuth({ ...configuracion, supabaseUrl: '', supabasePublishableKey: '' });
    } catch (causa) {
      error = causa;
    }
    expect(mensajeAuth(error, '')).toContain('environment.checkout-test.ts');
  });

  it('normaliza espacios y exige una URL base y una clave publicable', () => {
    expect(validarConfiguracionAuth({
      ...configuracion,
      supabaseUrl: configuracion.supabaseUrl + '/ ',
      supabasePublishableKey: ' ' + configuracion.supabasePublishableKey,
    })).toEqual({ url: configuracion.supabaseUrl, clave: configuracion.supabasePublishableKey });
    expect(() => validarConfiguracionAuth({
      ...configuracion, supabaseUrl: configuracion.supabaseUrl + '/auth/v1',
    })).toThrow();
    expect(() => validarConfiguracionAuth({
      ...configuracion, supabasePublishableKey: 'sb_secret_prueba',
    })).toThrow();
  });

  it('distingue rechazo de credenciales, restricciones de correo y fallo de red', () => {
    expect(mensajeAuth({ code: 'invalid_credentials', status: 401 }, '')).toContain('contraseña');
    expect(mensajeAuth({ code: 'invalid_api_key', status: 401 }, '')).toContain('mismo proyecto');
    expect(mensajeAuth({ code: 'email_address_not_authorized', status: 422 }, '')).toContain('servicio de correo');
    expect(mensajeAuth({ name: 'AuthRetryableFetchError', status: 0 }, '')).toContain('conectar');
    expect(mensajeAuth({ code: 'over_email_send_rate_limit', status: 429 }, '')).toContain('demasiados intentos');
    expect(mensajeAuth({ message: 'detalle interno' }, 'Intenta nuevamente')).toBe('Intenta nuevamente');
  });
});
