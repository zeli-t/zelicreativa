# Pruebas del checkout en zeli-creativa-test

El procedimiento usa dos cuentas ficticias activas con rol `cliente`. Puedes reutilizar las cuentas de la prueba de integridad si tienen un inicio de sesión por correo y contraseña funcional. Conserva los dos UUID y sus credenciales de prueba en tu equipo.

## Preparación manual

1. Abre **SQL Editor** desde **zeli-creativa-test** y comprueba la referencia del proyecto en la URL. Anota los conteos iniciales de `public.pedidos` y `public.direcciones`.
2. Pega `preparar.sql`, sustituye los dos UUID y ejecuta el archivo completo. Crea dos direcciones y dos variantes ficticias, cada una con stock 1. Las pruebas usan variantes distintas y pueden ejecutarse en cualquier orden.
3. Ejecuta `estado.sql`. Debe mostrar `ZELI-E2E-CARRERA` y `ZELI-E2E-API`, con stock 1, cero partidas, ventas y pagos, y una dirección para cada cliente.

## Concurrencia manual con dos conexiones

En el Dashboard de **zeli-creativa-test**, abre **Connect**. Usa la conexión directa o **Session pooler** si necesitas IPv4, mediante dos conexiones independientes de tu cliente PostgreSQL. Usa un cliente ya disponible. En este equipo Node está disponible, pero `psql` no apareció en el PATH. Dos pestañas de SQL Editor no sustituyen las sesiones persistentes para este procedimiento.

1. En cada conexión, ejecuta `select pg_backend_pid();` y verifica que los PID sean distintos. Comprueba también que ambas conexiones usen los datos de **zeli-creativa-test** del diálogo **Connect**.
2. Copia `concurrencia.sql` en la sesión **A**. Coloca el UUID de cliente A y la clave terminada en `0001` indicada en el archivo. Ejecuta el bloque completo. Debe devolver un pedido con estado `pagado`. Deja A abierta, sin confirmar la transacción.
3. Copia el mismo bloque en **B** con el UUID de cliente B y la clave terminada en `0002`. Ejecuta mientras A sigue abierta. B debe quedar esperando. Opcionalmente, desde una tercera conexión ejecuta `select pg_blocking_pids(<PID_B>);` sustituyendo el marcador por el PID numérico de B. Debe incluir el PID de A.
4. En cuanto confirmes la espera, ejecuta `COMMIT;` en A. B debe devolver SQLSTATE `P0001` con `STOCK_INSUFICIENTE_O_INVALIDO`. Ejecuta `ROLLBACK;` en B. Si B agota el tiempo o responde antes de confirmar A, la prueba no demuestra la concurrencia. Cierra las transacciones abiertas antes de revisar el estado o repetir.
5. Ejecuta `estado.sql`. En `ZELI-E2E-CARRERA` deben quedar stock **0**, **1** partida, **1** venta y **1** pago simulado.

## Integración automatizada con Node

Ejecuta este bloque desde la raíz del proyecto en PowerShell. Las contraseñas se introducen de forma oculta. Las variables son de este proceso y se eliminan al terminar. Usa la referencia y la clave **publicable** de **zeli-creativa-test**. Para esta variante solo se permite una ejecución exitosa por preparación.

```powershell
$env:ZELI_TEST_PROJECT_REF = Read-Host 'Referencia de zeli-creativa-test'
$env:ZELI_TEST_PUBLISHABLE_KEY = Read-Host 'Clave publicable de zeli-creativa-test'
try {
    foreach ($letra in 'A', 'B') {
        Set-Item -LiteralPath ('Env:ZELI_TEST_EMAIL_' + $letra) -Value (Read-Host "Correo ficticio $letra")
        $segura = Read-Host "Contraseña ficticia $letra" -AsSecureString
        $credencial = [pscredential]::new('prueba', $segura)
        Set-Item -LiteralPath ('Env:ZELI_TEST_PASSWORD_' + $letra) -Value $credencial.GetNetworkCredential().Password
    }
    node supabase/pruebas_checkout/integracion.mjs
    if ($LASTEXITCODE -ne 0) { throw 'La prueba de integración falló. Revisa estado.sql antes de repetir.' }
} finally {
    Remove-Item -LiteralPath @(
        'Env:ZELI_TEST_PROJECT_REF', 'Env:ZELI_TEST_PUBLISHABLE_KEY',
        'Env:ZELI_TEST_EMAIL_A', 'Env:ZELI_TEST_EMAIL_B',
        'Env:ZELI_TEST_PASSWORD_A', 'Env:ZELI_TEST_PASSWORD_B'
    ) -ErrorAction SilentlyContinue
    Remove-Variable segura,credencial -ErrorAction SilentlyContinue
}
```

El script comprueba la variante ficticia antes de iniciar sesión. Después autentica a ambos clientes con Auth y usa sus tokens para comprobar direcciones propias, cotización, teléfono omitido y nulo, restricción anónima, confirmación simulada, reintento idempotente, conflicto por cambiar el teléfono, stock agotado y visibilidad del contacto por RLS. Un fallo puede ocurrir después de confirmar el pedido. Revisa `estado.sql` y limpia antes de reiniciar la prueba. El caso exitoso de `ZELI-E2E-API` deja stock **0**, **1** partida, **1** venta y **1** pago simulado.

## Limpieza manual y comprobación

1. Cierra las dos conexiones de concurrencia. En SQL Editor de **zeli-creativa-test**, ejecuta `limpiar.sql` completo. Solo elimina los datos ficticios identificados por las variantes, direcciones y claves de este procedimiento. Si hay un pedido fuera de ese alcance o una referencia inesperada impide borrar un objeto, se cancela la transacción. No borra cuentas Auth ni datos del catálogo demo.
2. Ejecuta `estado.sql` de nuevo. Ambas consultas deben mostrar cero filas. Comprueba también que los conteos de `public.pedidos` y `public.direcciones` coincidan con el inicio.
3. Si necesitas conservar un registro de la ejecución, guarda únicamente los conteos, códigos de error y resultado, sin tokens, contraseñas ni correos.
