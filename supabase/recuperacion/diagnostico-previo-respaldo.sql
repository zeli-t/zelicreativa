-- Una sola sentencia SELECT para mostrar todas las secciones en SQL Editor.
WITH objetos AS (
    SELECT 'pg_class'::regclass AS clase, c.oid, n.nspname AS esquema
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    UNION ALL
    SELECT 'pg_proc'::regclass, p.oid, n.nspname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    UNION ALL
    SELECT 'pg_type'::regclass, t.oid, n.nspname
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    UNION ALL
    SELECT 'pg_constraint'::regclass, c.oid, n.nspname
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    UNION ALL
    SELECT x.clase, x.oid, n.nspname
    FROM (
        SELECT 'pg_trigger'::regclass AS clase, oid, tgrelid AS tabla FROM pg_trigger
        UNION ALL SELECT 'pg_policy'::regclass, oid, polrelid FROM pg_policy
        UNION ALL SELECT 'pg_rewrite'::regclass, oid, ev_class FROM pg_rewrite
        UNION ALL SELECT 'pg_attrdef'::regclass, oid, adrelid FROM pg_attrdef
    ) x
    JOIN pg_class c ON c.oid = x.tabla
    JOIN pg_namespace n ON n.oid = c.relnamespace
),
externas AS (
    SELECT DISTINCT s.esquema AS esquema_objeto,
           pg_describe_object(d.classid, d.objid, d.objsubid) AS objeto,
           r.esquema AS esquema_ref,
           pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) AS referencia,
           d.deptype AS tipo
    FROM pg_depend d
    JOIN objetos s ON s.clase = d.classid AND s.oid = d.objid
    LEFT JOIN objetos r ON r.clase = d.refclassid AND r.oid = d.refobjid
    WHERE (s.esquema IN ('public', 'zeli_privado')
       AND (r.esquema NOT IN ('public', 'zeli_privado', 'pg_catalog', 'pg_toast')
            OR d.refclassid IN ('pg_extension'::regclass, 'pg_collation'::regclass,
                                'pg_foreign_server'::regclass)))
       OR (s.esquema NOT IN ('public', 'zeli_privado', 'pg_catalog', 'pg_toast')
           AND r.esquema IN ('public', 'zeli_privado'))
),
roles_objetos AS (
    SELECT DISTINCT r.rolname AS rol, d.deptype AS tipo
    FROM pg_shdepend d
    JOIN pg_roles r ON r.oid = d.refobjid
    LEFT JOIN objetos o ON o.clase = d.classid AND o.oid = d.objid
    LEFT JOIN pg_namespace n ON d.classid = 'pg_namespace'::regclass AND n.oid = d.objid
    WHERE d.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND d.refclassid = 'pg_authid'::regclass
      AND COALESCE(o.esquema, n.nspname) IN ('public', 'zeli_privado')
),
folios AS (
    SELECT p.folio, p.estado, p.creado_en
    FROM public.pedidos p
    WHERE EXISTS (SELECT FROM public.detalle_pedido d WHERE d.pedido_id = p.id)
      AND EXISTS (SELECT FROM public.pagos g WHERE g.pedido_id = p.id)
      AND EXISTS (SELECT FROM public.movimientos_inventario m
                  WHERE m.pedido_id = p.id AND m.tipo = 'venta')
    ORDER BY p.creado_en DESC, p.id DESC
    LIMIT 3
),
secciones AS (
    SELECT 1 AS orden, 'extensiones_instaladas' AS seccion,
           (SELECT jsonb_agg(jsonb_build_object('nombre', e.extname, 'version', e.extversion,
                   'esquema', n.nspname) ORDER BY e.extname)
            FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace) AS resultado
    UNION ALL SELECT 2, 'dependencias_externas',
           (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.esquema_objeto, x.objeto, x.referencia) FROM externas x)
    UNION ALL SELECT 3, 'roles_propiedad_acl_politicas',
           (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.rol, x.tipo) FROM roles_objetos x)
    UNION ALL SELECT 4, 'roles_requeridos_por_politicas',
           (SELECT jsonb_agg(rol ORDER BY rol) FROM (
                SELECT DISTINCT unnest(roles) AS rol FROM pg_policies
                WHERE schemaname IN ('public', 'zeli_privado')
            ) r)
    UNION ALL SELECT 5, 'funciones_con_referencias_de_plataforma',
           (SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('public', 'zeli_privado')
              AND p.prosrc ~* '(auth|storage|extensions|vault|net)[[:space:]]*\.')
    UNION ALL SELECT 6, 'folios_candidatos',
           (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.creado_en DESC) FROM folios f)
)
SELECT seccion, COALESCE(resultado, '[]'::jsonb) AS resultado
FROM secciones
ORDER BY orden;
