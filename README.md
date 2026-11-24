# Zeli Creativa

Tienda académica de papelería creativa para la asignatura Temas Selectos de Tecnología de la Información. Incluye catálogo, favoritos, carrito por variante, cuentas de cliente, pedidos con comprobante PDF, seguimiento, devoluciones y un panel de administración.

**Estado:** ejecución local con Angular y `checkout-test`. El frontend todavía no está desplegado. La compra y el pago son simulados, el comprobante no es una factura fiscal y la demostración usa cuentas y datos ficticios.

## Tecnologías y requisitos

Angular 22, TypeScript 6, RxJS, Bootstrap 5, Bootstrap Icons y pdf-lib en el frontend. Supabase Auth y PostgREST conectan la aplicación con PostgreSQL, donde se aplican las reglas del pedido, los permisos y RLS.

Se verificó con Node.js **26.13.1** y npm **11.20.0** en Windows. Instala Git para trabajar con el repositorio. PostgreSQL **17.12** y sus herramientas de consola se usaron para el ensayo de recuperación y solo se requieren si se va a reproducir ese ejercicio.

## Instalación y configuración

Desde PowerShell en la raíz de una copia nueva:

```powershell
npm.cmd ci
if (-not (Test-Path -LiteralPath 'src/environments/environment.ts')) {
    Copy-Item 'src/environments/environment.ts.example' 'src/environments/environment.ts'
}
if (-not (Test-Path -LiteralPath 'src/environments/environment.checkout-test.ts')) {
    Copy-Item 'src/environments/environment.checkout-test.ts.example' 'src/environments/environment.checkout-test.ts'
}
```

En `src/environments/environment.checkout-test.ts`, completa `supabaseUrl` y `supabasePublishableKey` con la URL base y la clave **publicable** del mismo proyecto de Supabase de pruebas. Conserva `checkoutSimulado: true` para la demostración. El perfil base mantiene `checkoutSimulado: false`. Los dos archivos efectivos son locales e ignorados. Las plantillas pueden versionarse.

La clave publicable de Supabase está diseñada para el navegador. Los permisos se aplican mediante Auth, privilegios y RLS. Reserva las claves secretas, `service_role`, JWT de sesión y contraseñas de PostgreSQL para los contextos que las necesiten. `.env.example` enumera las variables de la integración Node opcional. El script Node lee variables del proceso y Angular usa los archivos TypeScript indicados.

Si necesitas un proyecto de Supabase **de pruebas nuevo y vacío**, aplica las migraciones de `supabase/migrations/` en orden 001 a 005 y después `supabase/seed_demo.sql`. Prepara cuentas ficticias con el perfil y rol correspondientes. Para reutilizar un esquema de pruebas ya instalado, verifica primero su estado. Consulta el [manual técnico](entrega-final/05-manual-tecnico-instalacion.md).

## Ejecución local

```powershell
npm.cmd start -- --configuration checkout-test
```

Abre `http://localhost:4200`. Usa una cuenta ficticia para agregar una variante con stock, seleccionar dirección, revisar la cotización, aceptar los términos y confirmar el pago simulado. La confirmación genera un pedido de prueba, descuenta existencias y muestra el folio. Una cuenta administradora puede consultar ese folio desde `/admin`.

## Pruebas y compilación

```powershell
npm.cmd test -- --watch=false
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
npm.cmd run build -- --configuration checkout-test
```

El resultado de la compilación queda en `dist/papevirtual/browser`. El [reporte de pruebas](entrega-final/09-plan-reporte-pruebas.md) registra la última corrida documentada de 62 pruebas, TypeScript y compilación, además de los casos manuales pendientes. Para integración con un proyecto aislado, consulta [pruebas_checkout](supabase/pruebas_checkout/README.md).

## Estructura

| Ruta | Contenido |
|---|---|
| `src/app/` | Pantallas, componentes, servicios, rutas y pruebas Angular |
| `src/environments/` | Plantillas para los perfiles base y de checkout |
| `public/` | Logo, favicon e imágenes del catálogo |
| `supabase/migrations/` y `supabase/seed_demo.sql` | Esquema, funciones, permisos y catálogo de demostración |
| `supabase/pruebas_checkout/` | Plantillas y scripts de integración |
| `supabase/recuperacion/` | Diagnóstico, respaldo, restauración aislada y verificación |
| `entrega-final/` | Manuales, API, modelo de datos, arquitectura, pruebas y evidencias académicas |

## Límites y publicación futura

En el entorno de compilación, configura `ZELI_SUPABASE_URL` y
`ZELI_SUPABASE_PUBLISHABLE_KEY` con la URL HTTPS y la clave publicable del mismo
proyecto de Supabase. Angular incorpora ambos valores al JavaScript del navegador.
El generador rechaza claves que no tengan el formato publicable y escribe los
archivos TypeScript ignorados por Git.

```sh
npm ci
node scripts/generar-entorno.mjs production
npm run build -- --configuration production
```

Para una vista previa del checkout simulado, usa un proyecto Supabase de pruebas
y sustituye `production` por `checkout-test` en los dos comandos. El directorio
de salida del sitio estático es `dist/papevirtual/browser`. Verifica el estado de
las migraciones, las redirecciones de Auth, la recarga de rutas SPA y los permisos
por rol en el entorno de destino antes de publicar.

El checkout y la logística se demuestran con datos ficticios. Los montos son simulados y el código no requiere datos bancarios. El respaldo académico verifica la recuperación de los datos de aplicación y se documenta en el [reporte de recuperación](entrega-final/11-reporte-recuperacion.md).

Para un despliegue futuro, [Cloudflare Pages para Angular](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/) puede servir los archivos estáticos de Angular y mantener Supabase como backend. El despliegue requerirá configurar el perfil de compilación, validar las rutas SPA al recargar, registrar las redirecciones de Auth y comprobar el acceso por roles. La versión actual se demuestra localmente.
