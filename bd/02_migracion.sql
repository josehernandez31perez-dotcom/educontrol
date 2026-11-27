-- =====================================================================
-- EduControl · Etapa E · 02_migracion.sql  (v4)
-- Cambios ADITIVOS sobre tablas EXISTENTES. No borra filas ni modifica valores.
-- NO PROBADO EN MARIADB 10.4.32. NO EJECUTAR en la base real sin autorización expresa,
-- copia de seguridad verificada y los resultados de bd/00_verificacion_previa.sql.
-- Requiere 01_nueva_estructura.sql ejecutado antes (crea secciones).
-- ATENCIÓN: no selecciona base. Seleccionarla ANTES.
-- =====================================================================
SELECT DATABASE() AS base_activa;

-- PASO 0 (solo lectura, ANTES de todo). Si cualquiera falla, DETENERSE:
--   a) SELECT COUNT(*) FROM usuarios WHERE rol = 'CONSULTA';           -- debe ser 0
--   b) SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS
--        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones' ORDER BY INDEX_NAME, SEQ_IN_INDEX;
--      -> debe aparecer EXACTAMENTE UN índice con NON_UNIQUE = 0 formado por (estudiante_id, materia_id).
--         Copiar su nombre EXACTO en el lugar marcado como <NOMBRE_INDICE_VERIFICADO> más abajo.
--   c) SELECT COUNT(*) FROM calificaciones;                             -- anotar (esperado 10)
--   d) Suma de control de las columnas originales, para comparar después:
--        SELECT SHA2(GROUP_CONCAT(CONCAT_WS('|', id, estudiante_id, materia_id, nota, fecha_registro)
--          ORDER BY id SEPARATOR ';'), 256) FROM calificaciones;     -- anotar

-- PASO 1. Roles y estado de usuarios.
--    Falla si existe alguna fila con rol CONSULTA (decisión 2: no se transforma nada automáticamente).
ALTER TABLE usuarios
  MODIFY rol ENUM('ADMIN','PROFESOR','ALUMNO') NOT NULL;
ALTER TABLE usuarios
  ADD COLUMN estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO' AFTER rol;

-- PASO 2. Vínculo estudiante -> cuenta (opcional, único).
ALTER TABLE estudiantes
  ADD COLUMN usuario_id INT UNSIGNED NULL DEFAULT NULL AFTER apellido;
ALTER TABLE estudiantes
  ADD CONSTRAINT uq_estudiantes_usuario UNIQUE (usuario_id);
ALTER TABLE estudiantes
  ADD CONSTRAINT fk_estudiantes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- PASO 3. Calificaciones: origen, período, clave de unicidad y coherencia con la sección.
--    Las 10 filas existentes quedan HEREDADA con sección y período NULL. Ningún valor se modifica.
ALTER TABLE calificaciones
  ADD COLUMN seccion_id INT UNSIGNED NULL DEFAULT NULL AFTER materia_id,
  ADD COLUMN periodo_id INT UNSIGNED NULL DEFAULT NULL AFTER seccion_id,
  ADD COLUMN origen ENUM('HEREDADA','ACTUAL') NOT NULL DEFAULT 'HEREDADA' AFTER periodo_id,
  ADD COLUMN periodo_clave INT UNSIGNED GENERATED ALWAYS AS (COALESCE(periodo_id, 0)) VIRTUAL;

ALTER TABLE calificaciones
  ADD CONSTRAINT chk_cal_origen CHECK (
    (origen = 'HEREDADA' AND seccion_id IS NULL AND periodo_id IS NULL) OR
    (origen = 'ACTUAL' AND seccion_id IS NOT NULL AND periodo_id IS NOT NULL));

-- La nueva unicidad empieza por estudiante_id: sirve también a la FK de estudiante.
ALTER TABLE calificaciones
  ADD CONSTRAINT uq_calificacion_final UNIQUE (estudiante_id, materia_id, periodo_clave);

-- Solo después de comprobar el nombre en el PASO 0b:
ALTER TABLE calificaciones
  DROP INDEX <NOMBRE_INDICE_VERIFICADO>;

ALTER TABLE calificaciones
  ADD KEY idx_cal_seccion (seccion_id, materia_id, periodo_id);
ALTER TABLE calificaciones
  ADD CONSTRAINT fk_cal_seccion_coherente FOREIGN KEY (seccion_id, materia_id, periodo_id)
    REFERENCES secciones (id, materia_id, periodo_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Filas nuevas deben declarar origen; el valor por defecto pasa a ser ACTUAL.
ALTER TABLE calificaciones
  ALTER COLUMN origen SET DEFAULT 'ACTUAL';

-- PASO 4. Comprobaciones posteriores (solo lectura). Esperado:
--   calificaciones = 10 (las mismas filas), todas HEREDADA, sin duplicados, suma de control = PASO 0d.
SELECT COUNT(*) AS calificaciones FROM calificaciones;
SELECT origen, COUNT(*) AS filas FROM calificaciones GROUP BY origen;
SELECT COUNT(*) AS duplicados FROM (
  SELECT estudiante_id, materia_id FROM calificaciones GROUP BY estudiante_id, materia_id HAVING COUNT(*) > 1) d;
SELECT SHA2(GROUP_CONCAT(CONCAT_WS('|', id, estudiante_id, materia_id, nota, fecha_registro)
  ORDER BY id SEPARATOR ';'), 256) AS suma_control FROM calificaciones;
SELECT COUNT(*) AS admin_activo FROM usuarios WHERE nombre_usuario = 'admin' AND rol = 'ADMIN';
