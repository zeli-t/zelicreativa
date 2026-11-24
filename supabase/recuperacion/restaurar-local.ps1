[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BinPg,
    [Parameter(Mandatory)][string]$DirectorioDatos,
    [Parameter(Mandatory)][string]$ArchivoDump
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$datos = (Resolve-Path -LiteralPath $DirectorioDatos).ProviderPath
$dump = (Resolve-Path -LiteralPath $ArchivoDump).ProviderPath
$psql = Join-Path $BinPg 'psql.exe'
$restore = Join-Path $BinPg 'pg_restore.exe'
if ($datos -notmatch '^[A-Za-z]:\\' -or
    -not (Test-Path -LiteralPath (Join-Path $datos 'PG_VERSION') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $datos 'global\pg_control') -PathType Leaf)) {
    throw 'El directorio debe pertenecer al cluster PostgreSQL local dedicado.'
}
if (-not (Test-Path -LiteralPath $dump -PathType Leaf)) {
    throw 'Indica el archivo de respaldo del proyecto de pruebas.'
}

$conexion = 'host=127.0.0.1 hostaddr=127.0.0.1 port=55432 user=postgres sslmode=disable connect_timeout=5'
$mantenimiento = "$conexion dbname=postgres"
$opcionesPsql = @('-X', '-W', '-v', 'ON_ERROR_STOP=1')
$comprobar = @'
select current_setting('data_directory')
where inet_server_addr() = inet '127.0.0.1'
  and inet_server_port() = 55432
  and current_setting('listen_addresses') = '127.0.0.1'
  and not pg_is_in_recovery();
'@

function Confirmar-ClusterLocal {
    param([string]$ConexionLocal)
    $rutaServidor = & $psql @opcionesPsql -qAt -d $ConexionLocal -c $comprobar
    if ($LASTEXITCODE -ne 0 -or @($rutaServidor).Count -ne 1 -or
        $rutaServidor -notmatch '^[A-Za-z]:[/\\]') {
        throw 'No se pudo identificar el cluster local en 127.0.0.1:55432.'
    }
    if ([IO.Path]::GetFullPath($rutaServidor).TrimEnd('\') -ine
        [IO.Path]::GetFullPath($datos).TrimEnd('\')) {
        throw 'El directorio del cluster conectado difiere del directorio dedicado.'
    }
}

$indice = & $restore --list $dump
if ($LASTEXITCODE -ne 0) { throw 'pg_restore no pudo leer el archivo.' }
$entradaPublic = '^\s*\d+;\s+2615\s+\d+\s+SCHEMA\s+-\s+public(?:\s|$)'
$coincidenciasPublic = @($indice | Where-Object { $_ -cmatch $entradaPublic })
if ($coincidenciasPublic.Count -gt 1) { throw 'El respaldo contiene varias entradas de esquema public.' }
Confirmar-ClusterLocal $mantenimiento
$base = 'zeli_recuperacion_' + [guid]::NewGuid().ToString('N')
$destino = "$conexion dbname=$base"
& $psql @opcionesPsql -d $mantenimiento -c "CREATE DATABASE $base TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE 'C'"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de recuperacion.' }
Confirmar-ClusterLocal $destino

$preparar = @'
BEGIN;
DO $roles$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END
$roles$;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
COMMIT;
'@
$preparar | & $psql @opcionesPsql -d $destino -f -
if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de las dependencias locales.' }

$opcionesRestore = @('-W', '--single-transaction', '--no-owner', '--no-privileges',
    '--dbname', $destino)
foreach ($seccion in @('pre-data', 'data', 'post-data')) {
    Confirmar-ClusterLocal $destino
    if ($seccion -eq 'post-data') {
        & $psql @opcionesPsql -d $destino -c 'INSERT INTO auth.users (id) SELECT id FROM public.usuarios'
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los UUID locales.' }
    }
    $opcionesSeccion = @("--section=$seccion")
    $listaTemporal = $null
    try {
        if ($seccion -eq 'pre-data' -and $coincidenciasPublic.Count -eq 1) {
            # template0 ya incluye public. Conservar sus tablas, comentarios y demas entradas del respaldo.
            $listaTemporal = [IO.Path]::GetTempFileName()
            [IO.File]::WriteAllLines($listaTemporal, [string[]]($indice | ForEach-Object {
                if ($_ -cmatch $entradaPublic) { '; ' + $_ } else { $_ }
            }), [Text.UTF8Encoding]::new($false))
            $opcionesSeccion += @('--use-list', $listaTemporal)
        }
        & $restore @opcionesRestore @opcionesSeccion $dump
        if ($LASTEXITCODE -ne 0) { throw "Fallo $seccion en $base. Conserva la salida para diagnostico." }
    } finally {
        if ($listaTemporal) { Remove-Item -LiteralPath $listaTemporal }
    }
}

Write-Output "Base local restaurada: $base"
