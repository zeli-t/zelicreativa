# Manual técnico y de instalación

**Zeli Creativa · Edición académica · Revisión 1 · 23 de noviembre de 2026**

La autora opera dos contextos para el ensayo. Angular usa `checkout-test` con Supabase alojado. La recuperación usa PostgreSQL independiente en el equipo de demostración.

## Instalación desde un equipo limpio

1. Instalar Node.js y npm compatibles con Angular 22. En esta revisión se usaron Node.js `26.13.1` y npm `11.20.0`. Para el ensayo de base de datos, instalar PostgreSQL `17.12` con `psql`, `pg_dump`, `pg_restore`, `initdb` y `pg_ctl`.
2. Obtener el código y abrir PowerShell en su raíz. Ejecutar `npm.cmd ci` para reproducir el archivo de bloqueo.
3. Verificar que la configuración `checkout-test` selecciona `src/environments/environment.checkout-test.ts` mediante `angular.json`. El entorno usa `supabaseUrl` y `supabasePublishableKey` del proyecto de pruebas. Gestionar la configuración de cada copia por separado y mantener cualquier contraseña de PostgreSQL o credencial privilegiada fuera del código.
4. Si se instala en un **proyecto de pruebas nuevo y vacío**, aplicar en este orden `001_esquema.sql`, `002_funciones.sql`, `003_seguridad.sql`, `004_catalogos_base.sql` y `005_seguridad_checkout.sql`. Ejecutar `seed_demo.sql` si se requiere catálogo de demostración. El proyecto de pruebas existente ya tiene las migraciones según el registro de ejecución de la autora.
5. Preparar una cuenta cliente y una administradora ficticias en el proyecto de pruebas. Verificar que cada una tenga perfil de aplicación y el rol correspondiente. El mantenimiento de identidad inicial corresponde al operador autorizado de Supabase.
6. Ejecutar `npm.cmd start -- --configuration checkout-test` y abrir `http://localhost:4200`. Verificar catálogo, acceso cliente y acceso administrativo con las cuentas de demostración.

## Comandos de verificación

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
npm.cmd test -- --watch=false
npm.cmd run build -- --configuration checkout-test
```

El resultado de la compilación queda en `dist/papevirtual`. El perfil de prueba usa mapas de origen y está destinado a demostración local. Una publicación futura requeriría configurar alojamiento HTTPS, reescritura SPA al archivo de entrada, configuración por ambiente y comprobar las URL autorizadas de recuperación de Auth.

## Estructura y mantenimiento

| Ruta | Responsabilidad |
|---|---|
| `src/app/pages`, `components` | Vistas y componentes reutilizables |
| `src/app/services` | Autenticación, catálogo, carrito, direcciones, pedidos y administración |
| `supabase/migrations` y `seed_demo.sql` | Esquema, funciones, seguridad y datos de demostración |
| `supabase/pruebas_checkout` | Integración y concurrencia |
| `supabase/recuperacion` | Diagnóstico, restauración local y verificación |

Ante un error de acceso, comprobar perfil, sesión y rol. Ante un error de catálogo, comprobar configuración de prueba y respuesta de PostgREST. Ante errores de compilación por lectura de directorios, comprobar permisos del entorno de ejecución y repetir desde una sesión con acceso al proyecto. Para errores de arranque local, consultar el log de PostgreSQL del clúster dedicado.

## Continuidad

La autora identifica la caída, registra fecha y síntoma, conserva el estado del origen y verifica la última copia disponible. Para el ensayo, los respaldos lógicos abarcan `public` y `zeli_privado`, con índice de contenido y SHA-256. Restaurar en una base **nueva** del clúster aislado y comparar integridad y un pedido por UUID antes de considerar válida la copia. La propuesta de retención es mantener dos copias verificadas durante 30 días, cifradas y con acceso restringido. Medir duración del proceso en cada ensayo. El [reporte de recuperación](11-reporte-recuperacion.md) registra el resultado de esta entrega.
