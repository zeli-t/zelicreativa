import assert from 'node:assert/strict';

const projectRef = process.env.ZELI_TEST_PROJECT_REF;
const apiKey = process.env.ZELI_TEST_PUBLISHABLE_KEY;
const users = ['A', 'B'].map(letter => ({
  email: process.env['ZELI_TEST_EMAIL_' + letter],
  password: process.env['ZELI_TEST_PASSWORD_' + letter],
}));
if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || !/^sb_publishable_/.test(apiKey ?? '')
  || !users.every(user => user.email && user.password)) {
  console.error('Configura la referencia y la clave publicable del proyecto de prueba y dos cuentas ficticias.');
  process.exit(1);
}

const base = 'https://' + projectRef + '.supabase.co';
async function request(path, { token, body } = {}) {
  const headers = { apikey: apiKey };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  return { ok: response.ok, status: response.status, data: await response.json() };
}

function success(result, label) {
  if (!result.ok) throw new Error(label + ': HTTP ' + result.status + ' ' + (result.data?.code ?? ''));
  return result.data;
}

function reject(result, code, message) {
  assert.equal(result.ok, false, 'Se esperaba un rechazo de la API');
  assert.equal(result.data.code, code);
  if (message) assert.equal(result.data.message, message);
}

const rpc = (token, body) => request('/rest/v1/rpc/registrar_pedido', { token, body });
const clave = n => '8b1f0000-0000-4000-8000-00000000000' + n;

try {
  // Comprobar la variante ficticia incluso antes de enviar credenciales.
  const variants = success(await request('/rest/v1/variantes_producto?select=id&sku=eq.ZELI-E2E-API'), 'Variante ficticia');
  assert.equal(variants.length, 1, 'Prepara primero la variante ficticia en zeli-creativa-test');
  const [a, b] = await Promise.all(users.map(async user => {
    const session = success(await request('/auth/v1/token?grant_type=password', { body: user }), 'Supabase Auth');
    assert.ok(session.access_token && session.user?.email);
    const addresses = success(await request(
      '/rest/v1/direcciones?select=id,usuario_id&referencia=eq.ZELI-CHECKOUT-E2E',
      { token: session.access_token },
    ), 'Dirección propia');
    assert.equal(addresses.length, 1);
    assert.equal(addresses[0].usuario_id, session.user.id);
    return { token: session.access_token, user: session.user, address: addresses[0].id };
  }));
  assert.notEqual(a.user.id, b.user.id);
  console.log('OK Auth y acceso a direcciones propias');

  const pedido = {
    p_items: [{ id: variants[0].id, cantidad: 1 }],
    p_direccion: a.address,
    p_idempotencia: clave(3),
    p_terminos_version: 'demo-v1',
  };
  const cotizar = { ...pedido, p_telefono_entrega: '868 123 4567' };
  const quotes = success(await rpc(a.token, cotizar), 'Cotización');
  assert.equal(quotes.estado, 'requiere_confirmacion');
  assert.ok(Number(quotes.total) > 0);
  const sinTelefono = { ...pedido, p_total_confirmado: quotes.total };
  for (const body of [sinTelefono, { ...sinTelefono, p_telefono_entrega: null }]) {
    reject(await rpc(a.token, body), '22023', 'TELEFONO_ENTREGA_INVALIDO');
  }
  const sinPedido = success(await request('/rest/v1/pedidos?select=id&clave_idempotencia=eq.' + clave(3),
    { token: a.token }), 'Comprobación del rechazo');
  assert.deepEqual(sinPedido, []);
  reject(await rpc(undefined, cotizar), '42501');
  console.log('OK teléfono obligatorio y RPC restringida a usuarios autenticados');

  const confirmacion = { ...cotizar, p_total_confirmado: quotes.total, p_idempotencia: clave(4) };
  const orden = success(await rpc(a.token, confirmacion), 'Confirmación');
  assert.ok(orden.id);
  assert.equal(orden.estado, 'pagado');
  assert.equal(Object.hasOwn(orden, 'contacto_entrega'), false);
  assert.deepEqual(success(await rpc(a.token, {
    ...confirmacion, p_telefono_entrega: '+52 (868) 123-45.67',
  }), 'Reintento'), orden);
  reject(await rpc(a.token, { ...confirmacion, p_telefono_entrega: '8687654321' }),
    '22023', 'IDEMPOTENCIA_EN_CONFLICTO');
  reject(await rpc(b.token, {
    ...confirmacion, p_direccion: b.address, p_idempotencia: clave(5),
  }), 'P0001', 'STOCK_INSUFICIENTE_O_INVALIDO');
  console.log('OK confirmación simulada, idempotencia, conflicto y stock agotado');

  const path = '/rest/v1/pedidos?select=contacto_entrega&id=eq.' + orden.id;
  const own = success(await request(path, { token: a.token }), 'Contacto propio');
  assert.equal(own.length, 1);
  assert.ok(own[0].contacto_entrega?.correo === a.user.email, 'El correo debe provenir de Auth');
  assert.equal(own[0].contacto_entrega?.telefono, '+528681234567');
  assert.deepEqual(success(await request(path, { token: b.token }), 'Contacto ajeno'), []);
  reject(await request(path), '42501');
  console.log('OK contacto histórico y RLS por PostgREST');
} catch (error) {
  // Evita imprimir cuerpos, credenciales, tokens o contactos en el error.
  if (error instanceof assert.AssertionError) {
    console.error('Falló una comprobación de integración:', error.generatedMessage ? 'resultado inesperado' : error.message);
  } else {
    console.error('Falló la integración:', error.message);
  }
  process.exitCode = 1;
}
