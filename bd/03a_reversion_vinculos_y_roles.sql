-- =====================================================================
-- EduControl · REVERSIÓN · 03a_reversion_vinculos_y_roles.sql  (v4)
-- Deshace los cambios de 02_migracion.sql sobre tablas EXISTENTES. Ejecutar DESPUÉS de 03b.
-- ** DESTRUCTIVO ** para: el vínculo estudiante-cuenta (se pierde qué cuenta correspondía a qué alumno),
-- la coherencia con la sección de las calificaciones (origen, sección y período se pierden),
-- y el estado de las cuentas. Las notas y las cuentas NO se borran.
-- NO PROBADO EN MARIADB 10.4.32.
-- Restaurar el ENUM de roles exige que no existan PROFESOR ni ALUMNO: si existen, PARAR.
-- =====================================================================
SELECT DATABASE() AS base_activa;

-- Paso 1. Comprobaciones previas (solo lectura).
SELECT COUNT(*) AS cuentas_profesor_o_alumno FROM usuarios WHERE rol IN ('PROFESOR','ALUMNO');  -- para restaurar el ENUM: 0
SELECT COUNT(*) AS alumnos_vinculados FROM estudiantes WHERE usuario_id IS NOT NULL;           -- informativo
SELECT COUNT(*) AS calificaciones_actuales FROM calificaciones WHERE origen = 'ACTUAL';        -- si > 0, la reversión rompe la unicidad antigua
SELECT COUNT(*) AS admin_activo FROM usuarios WHERE nombre_usuario = 'admin' AND rol = 'ADMIN';

-- Paso 2. Calificaciones: se restaura la unicidad ANTIGUA (estudiante, materia) con un nombre que decidimos nosotros.
--         Falla si hay notas ACTUAL de un mismo alumno y materia en distintos períodos (protección intencionada).
ALTER TABLE calificaciones ADD CONSTRAINT uq_calificaciones_estudiante_materia UNIQUE (estudiante_id, materia_id);
ALTER TABLE calificaciones DROP FOREIGN KEY fk_cal_seccion_coherente;
ALTER TABLE calificaciones DROP INDEX idx_cal_seccion;
ALTER TABLE calificaciones DROP INDEX uq_calificacion_final;
ALTER TABLE calificaciones DROP CONSTRAINT chk_cal_origen;
ALTER TABLE calificaciones DROP COLUMN periodo_clave;
ALTER TABLE calificaciones DROP COLUMN origen;
ALTER TABLE calificaciones DROP COLUMN periodo_id;
ALTER TABLE calificaciones DROP COLUMN seccion_id;

-- Paso 3. Estudiantes: quitar el vínculo con la cuenta.
ALTER TABLE estudiantes DROP FOREIGN KEY fk_estudiantes_usuario;
ALTER TABLE estudiantes DROP INDEX uq_estudiantes_usuario;
ALTER TABLE estudiantes DROP COLUMN usuario_id;

-- Paso 4. Usuarios: quitar el estado y restaurar el ENUM anterior (falla si hay PROFESOR o ALUMNO).
ALTER TABLE usuarios DROP COLUMN estado;
ALTER TABLE usuarios MODIFY rol ENUM('ADMIN','CONSULTA') NOT NULL DEFAULT 'CONSULTA';

-- Paso 5. Verificación (esperado: estudiantes=3, materias=5, calificaciones=10, admin_activo=1).
SELECT
  (SELECT COUNT(*) FROM estudiantes) AS estudiantes,
  (SELECT COUNT(*) FROM materias) AS materias,
  (SELECT COUNT(*) FROM calificaciones) AS calificaciones,
  (SELECT COUNT(*) FROM usuarios WHERE nombre_usuario = 'admin' AND rol = 'ADMIN') AS admin_activo;
