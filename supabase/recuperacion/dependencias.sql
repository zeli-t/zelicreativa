BEGIN READ ONLY;

SELECT current_setting('server_version') AS version_postgresql;

SELECT datname AS base,
       pg_encoding_to_char(encoding) AS codificacion,
       datlocprovider AS proveedor_locale,
       datcollate AS ordenamiento,
       datctype AS clasificacion,
       datlocale AS locale_proveedor
FROM pg_database
WHERE datname = current_database();

SELECT extname, extversion, extnamespace::regnamespace AS esquema
FROM pg_extension
ORDER BY extname;

WITH dependencias AS (
    SELECT d.*, o.identity AS objeto, r.identity AS referencia,
           COALESCE(o.schema, n.nspname) AS esquema_objeto, r.schema AS esquema_referencia
    FROM pg_depend d
    CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) o
    CROSS JOIN LATERAL pg_identify_object(d.refclassid, d.refobjid, d.refobjsubid) r
    LEFT JOIN pg_class c ON c.oid = CASE d.classid
        WHEN 'pg_constraint'::regclass THEN (SELECT conrelid FROM pg_constraint WHERE oid = d.objid)
        WHEN 'pg_trigger'::regclass THEN (SELECT tgrelid FROM pg_trigger WHERE oid = d.objid)
        WHEN 'pg_policy'::regclass THEN (SELECT polrelid FROM pg_policy WHERE oid = d.objid)
        WHEN 'pg_rewrite'::regclass THEN (SELECT ev_class FROM pg_rewrite WHERE oid = d.objid)
        WHEN 'pg_attrdef'::regclass THEN (SELECT adrelid FROM pg_attrdef WHERE oid = d.objid)
    END
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
)
SELECT DISTINCT esquema_objeto, objeto, esquema_referencia, referencia, deptype
FROM dependencias
WHERE (esquema_objeto IN ('public', 'zeli_privado')
       AND (esquema_referencia NOT IN ('public', 'zeli_privado')
            OR refclassid = 'pg_extension'::regclass))
   OR (esquema_objeto NOT IN ('public', 'zeli_privado')
       AND esquema_referencia IN ('public', 'zeli_privado'))
ORDER BY esquema_objeto, objeto, referencia;

SELECT DISTINCT o.identity AS objeto, r.rolname, d.deptype
FROM pg_shdepend d
JOIN pg_roles r ON r.oid = d.refobjid
CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) o
LEFT JOIN pg_policy p ON d.classid = 'pg_policy'::regclass AND p.oid = d.objid
LEFT JOIN pg_class c ON c.oid = p.polrelid
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE d.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND d.refclassid = 'pg_authid'::regclass
  AND (COALESCE(o.schema, n.nspname) IN ('public', 'zeli_privado')
       OR (d.classid = 'pg_namespace'::regclass AND o.name IN ('public', 'zeli_privado')))
ORDER BY objeto, r.rolname, d.deptype;

SELECT schemaname, tablename, policyname, roles
FROM pg_policies
WHERE schemaname IN ('public', 'zeli_privado')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'folio')
   OR (table_schema = 'auth' AND table_name = 'users'
       AND column_name IN ('id', 'email', 'raw_user_meta_data'))
ORDER BY table_schema, table_name, column_name;

-- Las referencias dentro de cuerpos SQL o PL/pgSQL no siempre aparecen en pg_depend.
SELECT p.oid::regprocedure AS funcion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'zeli_privado')
  AND p.prokind IN ('f', 'p')
  AND p.prosrc ~* '(auth|storage|extensions|vault|net)[[:space:]]*\.'
ORDER BY p.oid::regprocedure::text;

ROLLBACK;
