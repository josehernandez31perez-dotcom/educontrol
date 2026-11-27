-- =====================================================================
-- EduControl · Etapa E (Parte 1) · 00_verificacion_previa.sql
-- SOLO LECTURA. Ejecutar en la base REAL antes de cualquier migración.
-- No contiene INSERT, UPDATE, DELETE, ALTER, CREATE ni DROP.
-- Objetivo: confirmar que la base real coincide con el esquema documentado.
-- Anotar los resultados; si algo no coincide, NO continuar con 02.
-- =====================================================================
-- ATENCIÓN: este script NO selecciona base de datos. Seleccionar la base ANTES de ejecutar
-- (phpMyAdmin: elegir la base en el panel izquierdo; consola: USE <base>;).
SELECT DATABASE() AS base_activa;  -- comprobar que es la base correcta

-- 1. Definición actual de las tablas que se van a tocar
SHOW CREATE TABLE usuarios;
SHOW CREATE TABLE estudiantes;
SHOW CREATE TABLE materias;
SHOW CREATE TABLE calificaciones;

-- 2. Motor, juego de caracteres e intercalación de todas las tablas
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- 3. Vistas existentes (deben seguir existiendo tras la migración)
SELECT TABLE_NAME
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- 4. Valores permitidos de estudiantes.estado (la migración NO lo modifica)
--    Debe incluir ACTIVO, INACTIVO, RETIRADO y GRADUADO.
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estudiantes' AND COLUMN_NAME = 'estado';

-- 5. Conteos de referencia (esperado: 3 estudiantes, 5 materias, 10 calificaciones)
SELECT
  (SELECT COUNT(*) FROM estudiantes)   AS estudiantes,
  (SELECT COUNT(*) FROM materias)      AS materias,
  (SELECT COUNT(*) FROM calificaciones) AS calificaciones;

-- 6. Cuentas de usuario sin contraseña (no se lee el hash)
SELECT id, nombre_usuario, rol
FROM usuarios
ORDER BY id;

-- 7. La cuenta admin debe existir con rol ADMIN (esperado: 1)
SELECT COUNT(*) AS admin_activo
FROM usuarios
WHERE nombre_usuario = 'admin' AND rol = 'ADMIN';

-- 8. Huérfanos actuales (esperado: 0 en ambas)
SELECT COUNT(*) AS calificaciones_sin_estudiante
FROM calificaciones c LEFT JOIN estudiantes e ON e.id = c.estudiante_id
WHERE e.id IS NULL;

SELECT COUNT(*) AS calificaciones_sin_materia
FROM calificaciones c LEFT JOIN materias m ON m.id = c.materia_id
WHERE m.id IS NULL;

-- 9. Las tablas nuevas NO deben existir todavía (esperado: 0 filas)
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('periodos_academicos', 'profesores', 'secciones', 'profesor_seccion', 'estudiante_seccion');

-- 10. Versión del servidor (esperado: MariaDB 10.4.x)
SELECT VERSION() AS version_servidor;

-- 11. Versión y modo SQL del servidor
--     ESPERADO: version 10.4.x; sql_mode incluye STRICT_TRANS_TABLES (sin esto, algunas
--     comprobaciones de los scripts de prueba no se cumplirían).
SELECT VERSION() AS version_servidor, @@sql_mode AS sql_mode;

-- 12. Colisión de nombres: ninguna restricción nueva debe existir ya en la base.
--     ESPERADO: 0 filas. Si aparece alguna, renombrar la restricción en 01/02 antes de continuar.
SELECT CONSTRAINT_NAME, TABLE_NAME
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN (
    'chk_aud_motivo',
    'chk_cal_origen',
    'chk_es_fin',
    'chk_evaluaciones_nombre',
    'chk_evaluaciones_peso',
    'chk_no_aplica_motivo',
    'chk_no_aplica_revocacion',
    'chk_notas_eval_rango',
    'chk_obs_texto',
    'chk_periodos_anio',
    'chk_periodos_cierre',
    'chk_periodos_fechas',
    'chk_periodos_nombre',
    'chk_profesor_seccion_fin',
    'chk_profesores_apellido',
    'chk_profesores_cedula',
    'chk_profesores_nombre',
    'chk_secciones_codigo',
    'fk_aud_usuario',
    'fk_cal_seccion_coherente',
    'fk_es_estudiante',
    'fk_es_seccion_coherente',
    'fk_estudiantes_usuario',
    'fk_evaluaciones_seccion',
    'fk_no_aplica_estudiante',
    'fk_no_aplica_evaluacion',
    'fk_no_aplica_marcado',
    'fk_no_aplica_revocado',
    'fk_notas_estudiante',
    'fk_notas_evaluacion',
    'fk_obs_autor',
    'fk_obs_estudiante',
    'fk_obs_seccion',
    'fk_pend_estudiante',
    'fk_pend_periodo',
    'fk_pend_resuelto',
    'fk_pend_seccion',
    'fk_profesor_seccion_profesor',
    'fk_profesor_seccion_seccion',
    'fk_profesores_usuario',
    'fk_secciones_materia',
    'fk_secciones_periodo',
    'uq_calificacion_final',
    'uq_es_activa_materia_periodo',
    'uq_estudiantes_usuario',
    'uq_evaluaciones_seccion_nombre',
    'uq_no_aplica_vigente',
    'uq_notas_eval_alumno',
    'uq_pendiente_abierto',
    'uq_periodos_anio_nombre',
    'uq_profesor_seccion_activa',
    'uq_profesores_cedula',
    'uq_profesores_usuario',
    'uq_secciones_id_materia_periodo',
    'uq_secciones_materia_periodo_codigo'
  );
