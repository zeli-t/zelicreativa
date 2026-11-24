param(
    [Parameter(Mandatory)]
    [guid]$Folio
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Folio -eq [guid]::Empty) {
    throw 'Indica el folio UUID de un pedido del proyecto de pruebas.'
}
$folioUuid = $Folio.ToString('D')

$bin = 'C:\Program Files\PostgreSQL\17\bin'
$trabajo = Join-Path $env:LOCALAPPDATA 'ZeliRecuperacion'
$datos = Join-Path $trabajo 'pgdata17'
$raiz = Join-Path $PSScriptRoot '..\..'
$config = Get-Content -LiteralPath (Join-Path $raiz 'src\environments\environment.checkout-test.ts') -Raw
$proyecto = [regex]::Match($config, 'https://([a-z0-9]+)\.supabase\.co').Groups[1].Value
if (-not $proyecto) { throw 'No se pudo identificar el proyecto de checkout-test.' }

$modo = (Read-Host 'Modo de Connect de zeli-creativa-test: 1 Session pooler, 2 Direct connection').Trim()
if ($modo -notin @('1', '2')) { throw 'Selecciona 1 o 2.' }
$servidor = (Read-Host 'Host exacto de Connect (solo el host, puerto 5432)').Trim()
$usuario = (Read-Host 'Usuario exacto de la misma opcion de Connect').Trim()
if ($usuario -cnotmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]*$') {
    throw 'Introduce solo el usuario de PostgreSQL, sin URL ni contrasena.'
}
if ($modo -eq '1') {
    if ($servidor -notmatch '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$' -or
        $usuario -cnotmatch ('^.+\.' + [regex]::Escape($proyecto) + '$')) {
        throw 'El host y el usuario deben venir de Session pooler de zeli-creativa-test. El sufijo del usuario debe coincidir con checkout-test.'
    }
} else {
    if ($servidor -ne "db.$proyecto.supabase.co") {
        throw 'El host de Direct connection debe corresponder al proyecto configurado en checkout-test.'
    }
}
$rutaCert = (Read-Host 'Ruta del certificado raiz de Supabase').Trim().Trim('"')
$certificado = (Resolve-Path -LiteralPath $rutaCert).ProviderPath.Replace('\', '/').Replace("'", "\'")
$origen = "host=$servidor port=5432 dbname=postgres user=$usuario sslmode=verify-full gssencmode=disable sslrootcert='$certificado' connect_timeout=10 options='-c default_transaction_read_only=on'"

Write-Host 'Comprobando el origen con TLS y una transaccion de solo lectura.'
$prueba = @'
BEGIN READ ONLY;
SELECT current_database() || ':' || current_setting('transaction_read_only');
ROLLBACK;
'@
$estadoOrigen = & "$bin\psql.exe" -X -W -qAt -d $origen -v ON_ERROR_STOP=1 -c $prueba
if ($LASTEXITCODE -ne 0) {
    throw 'Fallo la conexion inicial. Si PostgreSQL muestra ENOTFOUND, copia de nuevo el host y el usuario juntos desde la misma opcion de Connect de zeli-creativa-test. Si muestra un error TLS, revisa el certificado raiz. No se inicio el respaldo.'
}
if ($estadoOrigen -cne 'postgres:on') {
    throw 'No se confirmo la base postgres en modo de solo lectura. No se inicio el respaldo.'
}
Write-Host 'Conexion de solo lectura confirmada.'

$carpeta = Join-Path $trabajo ('ensayo-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $carpeta | Out-Null
$dump = Join-Path $carpeta 'zeli-creativa-test.dump'
$verificar = Join-Path $PSScriptRoot 'verificar-recuperacion.sql'
$origenTxt = Join-Path $carpeta 'origen.txt'
$restauradoTxt = Join-Path $carpeta 'restaurado.txt'
$inicio = Get-Date
$env:PGCLIENTENCODING = 'UTF8'

Write-Host 'Introduce la contrasena de PostgreSQL del proyecto de pruebas cuando se solicite.'
& "$bin\psql.exe" -X -W -d $origen -v ON_ERROR_STOP=1 -v "folio=$folioUuid" -f $verificar -o $origenTxt
if ($LASTEXITCODE -ne 0) { throw 'Fallo la consulta del origen.' }
$coincidencias = @(Select-String -Pattern $folioUuid -SimpleMatch -Path $origenTxt)
if ($coincidencias.Count -ne 1) { throw 'El folio seleccionado no aparece exactamente una vez.' }
& "$bin\pg_dump.exe" -W -d $origen --format=custom --schema=public --schema=zeli_privado --file=$dump
if ($LASTEXITCODE -ne 0) { throw 'Fallo pg_dump.' }
$indice = & "$bin\pg_restore.exe" --list $dump
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el indice del respaldo.' }
$indice | Set-Content -Encoding UTF8 (Join-Path $carpeta 'contenido-respaldo.txt')
$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $dump).Hash
$sha | Set-Content -Encoding ASCII (Join-Path $carpeta 'sha256.txt')

Write-Host 'Introduce ahora la contrasena del cluster local cuando se solicite.'
$salida = @(& (Join-Path $PSScriptRoot 'restaurar-local.ps1') -BinPg $bin -DirectorioDatos $datos -ArchivoDump $dump)
$salida | Write-Host
$base = [regex]::Match(($salida -join "`n"), 'Base local restaurada: (zeli_recuperacion_[a-f0-9]{32})').Groups[1].Value
if (-not $base) { throw 'No se pudo identificar la base nueva.' }
$local = "host=127.0.0.1 hostaddr=127.0.0.1 port=55432 user=postgres dbname=$base sslmode=disable"
& "$bin\psql.exe" -X -W -d $local -v ON_ERROR_STOP=1 -v "folio=$folioUuid" -f $verificar -o $restauradoTxt
if ($LASTEXITCODE -ne 0) { throw 'Fallo la verificacion local.' }

$iguales = (Get-FileHash -LiteralPath $origenTxt).Hash -eq (Get-FileHash -LiteralPath $restauradoTxt).Hash
@(
    "Inicio: $($inicio.ToString('o'))"
    "Fin: $((Get-Date).ToString('o'))"
    "Folio: $folioUuid"
    "Base nueva: $base"
    "Tamano respaldo: $((Get-Item -LiteralPath $dump).Length) bytes"
    "SHA256: $sha"
    "Salidas identicas: $iguales"
) | Tee-Object -FilePath (Join-Path $carpeta 'resultado.txt')
Write-Host "Evidencia: $carpeta"
if (-not $iguales) { throw 'Las salidas difieren. Revisa origen.txt y restaurado.txt.' }
