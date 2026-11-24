# Entregable 4 · Código fuente completo

**Proyecto individual** Zeli Creativa. **Versión técnica** `0.0.0` según `package.json`. **Estado operativo** Angular local con `checkout-test`, compras simuladas y frontend sin desplegar.

## Contenido preparado

| Elemento | Evidencia |
|---|---|
| Frontend | Angular 22, TypeScript 6, RxJS, Bootstrap 5, Bootstrap Icons y pdf-lib. Código, rutas y pruebas en `src/app/`; recursos en `public/`. |
| Backend y datos | Supabase Auth, PostgREST y PostgreSQL. Migraciones 001–005, semilla, verificaciones y recuperación en `supabase/`. |
| Reproducibilidad | `package-lock.json`, configuración Angular y TypeScript, plantillas de ambientes, `.env.example` y [README](../README.md). |
| Documentación | [Índice académico](01-indice.md), API/OpenAPI, manuales, modelo de datos, pruebas y reporte de recuperación. |

## Estado de Git y seguridad

La carpeta revisada y sus directorios superiores no mostraron un marcador `.git`. Git tampoco se encontró en PATH ni en las ubicaciones habituales comprobadas. Rama, remoto, historial, archivos rastreados y cambios pendientes son **no verificables desde esta copia**. La entrega a GitHub queda pendiente de recuperar la copia con historial o de inicializar un repositorio nuevo si no existe uno previo.

Los dos ambientes locales contienen URL HTTPS sin credenciales y claves publicables de Supabase. Se conservaron intactos y se excluyeron del paquete con reglas de Git. La búsqueda estática por firmas comunes no detectó claves privadas, claves secretas de Supabase, tokens de GitHub o URL PostgreSQL con contraseña en los archivos revisados. Esta búsqueda cubre la copia visible y no verifica un historial ajeno.

También se excluyen dependencias, compilados, configuración local, respaldos, credenciales y dos scripts SQL locales con identificadores de cuentas ficticias precargados. Las plantillas equivalentes permanecen en el repositorio. Las evidencias privadas deben quedar bajo `entrega-final/evidencia/privada/` o fuera del repositorio. Para publicar capturas, primero revisar que usen datos ficticios y que no muestren configuraciones o sesiones.

## Antes del primer commit

1. Si existe un repositorio anterior, abrir o clonar esa copia y trasladar los cambios de preparación sin sustituir sus metadatos. Si esta es la primera versión, instalar Git, crear un repositorio privado vacío sin README en GitHub e inicializar la carpeta local con `git init -b main`.
2. Consultar `git status --short --branch` y `git remote -v`. Añadir `origin` con la URL de GitHub únicamente si todavía no está configurado.
3. Ejecutar `git add --dry-run .` y revisar la lista. Confirmar con `git check-ignore -v -- src/environments/environment.ts src/environments/environment.checkout-test.ts` que ambos ambientes locales están excluidos. En una copia con historial, verificar también los archivos rastreados y su historial porque `.gitignore` no retira archivos ya versionados.
4. Tras aprobar la revisión, preparar el commit y subir la rama confirmada. Mantener el repositorio privado mientras se verifica la licencia propia y el permiso de publicación de los recursos visuales. Compartir el acceso con el profesor por el canal de la asignatura.

La validación funcional documentada corresponde a la corrida anterior de 62 pruebas y la compilación de `checkout-test`. La preparación documental de este entregable no realizó commits, push ni despliegue.
