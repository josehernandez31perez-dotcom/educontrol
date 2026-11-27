-- =====================================================================
-- EduControl · REVERSIÓN · 03b_reversion_tablas_nuevas.sql  (v4)
-- ** DESTRUCTIVO ** Borra las tablas NUEVAS de 01 y de 04 con TODO su contenido.
-- ORDEN: ejecutar ESTE archivo PRIMERO, después 03a_reversion_vinculos_y_roles.sql.
-- NO PROBADO EN MARIADB 10.4.32.
-- Cuándo puede usarse: solo si las tablas están vacías (comprobación abajo), o si se ha decidido
-- descartar sus datos por escrito Y existe copia de seguridad restaurable.
-- No transaccional: cada DROP confirma. Ejecutar sentencia a sentencia.
-- Sin IF EXISTS: una tabla que falta detiene el script (estado inesperado).
-- =====================================================================
SELECT DATABASE() AS base_activa;   -- comprobar que es la base de PRUEBA o la real con autorización

-- Paso 1. Comprobar contenido. Si alguna fila es > 0, NO continuar sin decisión escrita y copia.
SELECT 'sesiones_app' AS tabla, COUNT(*) AS filas FROM sesiones_app
UNION ALL SELECT 'auditoria_academica', COUNT(*) FROM auditoria_academica
UNION ALL SELECT 'observaciones', COUNT(*) FROM observaciones
UNION ALL SELECT 'pendientes_calificacion', COUNT(*) FROM pendientes_calificacion
UNION ALL SELECT 'evaluacion_no_aplica', COUNT(*) FROM evaluacion_no_aplica
UNION ALL SELECT 'notas_evaluacion', COUNT(*) FROM notas_evaluacion
UNION ALL SELECT 'evaluaciones', COUNT(*) FROM evaluaciones
UNION ALL SELECT 'estudiante_seccion', COUNT(*) FROM estudiante_seccion
UNION ALL SELECT 'profesor_seccion', COUNT(*) FROM profesor_seccion
UNION ALL SELECT 'secciones', COUNT(*) FROM secciones
UNION ALL SELECT 'profesores', COUNT(*) FROM profesores
UNION ALL SELECT 'periodos_academicos', COUNT(*) FROM periodos_academicos;

-- Paso 2. Borrar en orden de dependencias (hijos antes que padres).
DROP TABLE sesiones_app;
DROP TABLE observaciones;
DROP TABLE pendientes_calificacion;
DROP TABLE evaluacion_no_aplica;
DROP TABLE notas_evaluacion;
DROP TABLE evaluaciones;
DROP TABLE estudiante_seccion;
DROP TABLE profesor_seccion;
DROP TABLE secciones;
DROP TABLE profesores;
DROP TABLE periodos_academicos;
DROP TABLE auditoria_academica;

-- Paso 3. Comprobar (esperado: 0 filas).
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sesiones_app','observaciones','pendientes_calificacion','evaluacion_no_aplica','notas_evaluacion',
    'evaluaciones','estudiante_seccion','profesor_seccion','secciones','profesores','periodos_academicos','auditoria_academica');
