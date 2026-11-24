import { readFileSync, writeFileSync } from 'node:fs';

const perfil = process.argv[2];
if (perfil !== 'production' && perfil !== 'checkout-test') {
  throw new Error('Indica el perfil production o checkout-test.');
}

const url = process.env.ZELI_SUPABASE_URL?.trim().replace(/\/$/, '');
const clave = process.env.ZELI_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url ?? '')) {
  throw new Error('ZELI_SUPABASE_URL debe ser la URL base HTTPS del proyecto Supabase.');
}
if (!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(clave ?? '')) {
  throw new Error('ZELI_SUPABASE_PUBLISHABLE_KEY debe ser una clave publicable de Supabase.');
}

const base = new URL('../src/environments/environment.ts', import.meta.url);
const checkout = new URL('../src/environments/environment.checkout-test.ts', import.meta.url);
const checkoutSimulado = perfil === 'checkout-test';
const configuracion = { supabaseUrl: url, supabasePublishableKey: clave, checkoutSimulado };

if (checkoutSimulado) {
  try {
    writeFileSync(base, readFileSync(new URL('environment.ts.example', base)), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

writeFileSync(checkoutSimulado ? checkout : base,
  `export const environment = ${JSON.stringify(configuracion, null, 2)};\n`);
