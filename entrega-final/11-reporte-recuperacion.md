# Reporte académico de respaldo y recuperación

**Fecha del ensayo** 23 de noviembre de 2026. El origen fue un proyecto de pruebas en Supabase y el destino, una base nueva en un clúster PostgreSQL local dedicado.

## Evidencia comprobada

| Verificación | Resultado |
|---|---|
| Herramientas PostgreSQL | `psql`, `pg_dump` y `pg_restore` respondieron con 17.12. |
| Configuración local | El registro del clúster confirma PostgreSQL 17.12 y la configuración del destino dedicado. |
| Dependencias | El diagnóstico confirmó PostgreSQL 17.12 y UTF8 con proveedor ICU y ordenamiento y clasificación `en_US.UTF-8`. El CSV de catálogo registra referencias a `auth.users` y `auth.uid()`, cubiertas por los objetos auxiliares locales. El disparador de perfil reside en el esquema externo `auth`. Las políticas requieren `anon` y `authenticated`; `service_role` solo aparece en permisos, que quedan fuera de la restauración. El CSV no registra dependencias de aplicación hacia las extensiones instaladas en esquemas externos. |
| Seguridad del destino | El script usa dirección y puerto fijos, comprueba escucha y directorio de datos y crea una base nueva. La ejecución registrada llegó hasta la verificación de la base restaurada. |

## Registro del ensayo

| Evidencia | Resultado |
|---|---|
| Duración total | **3 min 52.24 s** de inicio a fin. |
| Archivo e índice | Formato custom, **147044 bytes**, 347 entradas en el índice, generado con `pg_dump` 17.12 desde PostgreSQL 17.12. |
| SHA-256 del respaldo | El hash recalculado coincidió con los registros locales. |
| Conteos | Coinciden las **25 tablas** listadas. Entre ellas, 3 usuarios de aplicación, 2 direcciones, 16 productos, 19 variantes, 19 filas de inventario, 2 pedidos, 4 partidas, 2 pagos y 21 movimientos de inventario. |
| Integridad referencial | Las **36 claves foráneas** listadas tienen `convalidated = true` en ambas salidas. Los cuatro cruces de huérfanos devuelven cero: usuario/identidad, pedido/dirección propia, partida/pedido o variante y movimiento/inventario o pedido asociado. |
| Pedido verificado | Se comprobó la recuperación del estado entregado, cuatro cambios de estado, las partidas, el pago simulado aprobado y los movimientos de inventario. |
| Comparación | Las dos salidas de 9016 bytes tuvieron el mismo SHA-256. El resultado registrado fue `Salidas idénticas: True`. |

## Procedimiento reproducible

Desde la raíz del repositorio, con el clúster dedicado en marcha, ejecutar en PowerShell:

```powershell
.\supabase\recuperacion\ejecutar-ensayo.ps1 -Folio (Read-Host 'UUID de un pedido del proyecto de pruebas')
```

1. Elegir **Session pooler** o **Direct connection** y proporcionar el host, el usuario y el certificado raíz del proyecto de pruebas. Introducir cada contraseña únicamente en el aviso de PostgreSQL. El script comprueba el origen con TLS `verify-full` y una transacción de solo lectura.
2. Ejecutar `verificar-recuperacion.sql` sobre el origen y registrar la salida en `origen.txt`. `pg_dump` exporta `public` y `zeli_privado` en formato custom. Se guarda el índice de `pg_restore --list` y se calcula SHA-256.
3. `restaurar-local.ps1` verifica dirección, escucha y directorio del clúster, crea una base UTF8 y restaura `pre-data`, `data` y `post-data`. Omite solo la creación redundante de `public` ya presente en `template0`. Antes de `post-data`, prepara las identidades auxiliares requeridas por la clave foránea a Auth.
4. Ejecutar `verificar-recuperacion.sql` sobre el destino con el mismo folio UUID. El script compara los hashes de `origen.txt` y `restaurado.txt` y registra el resultado. Las consultas de verificación comprueban conteos, claves foráneas y cruces de huérfanos, y consultan el pedido con partidas, pago y movimientos.

## Alcance de la comparación

La igualdad de los archivos demuestra que las consultas seleccionadas devolvieron la misma salida textual en ambos ambientes. Incluye los conteos de las tablas, las definiciones y el estado de las claves foráneas listadas, los cuatro cruces de huérfanos y los datos consultados del folio. Los conteos coincidentes por sí solos no demuestran igualdad de todas las filas. La corrida no compara cada campo de cada tabla, no prueba los permisos efectivos alojados y no restaura Supabase Auth, Storage ni otros servicios administrados.

## Archivos y capturas para la entrega

Los registros originales se conservan en la carpeta local de evidencias del ensayo.

| Captura | Archivo | Mostrar |
|---|---|---|
| 01 · Destino aislado | `verificacion-cluster-local.txt` | Versión de PostgreSQL y comprobación del destino dedicado. |
| 02 · Respaldo | `contenido-respaldo.txt` y `sha256.txt` | Formato, versiones, 347 entradas y confirmación de la verificación del hash. |
| 03 · Integridad | `origen.txt` y `restaurado.txt` | Conteos de las tablas principales, claves foráneas validadas y los cuatro resultados de cero huérfanos. |
| 04 · Pedido recuperado | `restaurado.txt` | Estado entregado y confirmación de tres partidas, un pago simulado y tres movimientos de venta. |
| 05 · Cierre del ensayo | `resultado.txt` | Duración, tamaño y resultado de la comparación. |

El respaldo, los hashes completos y las salidas originales quedan en la evidencia local. La versión pública omite los identificadores, los importes y los datos de configuración de la máquina. Una verificación independiente de los hashes requiere acceso a los archivos originales.

[Registro técnico de la sesión local](evidencia/validacion-local.txt)

**Conclusión:** el ensayo académico de respaldo y restauración de los datos relacionales de la aplicación quedó aprobado. La evidencia acredita la recuperación del folio seleccionado, sus partidas, su pago simulado y sus movimientos de inventario.
