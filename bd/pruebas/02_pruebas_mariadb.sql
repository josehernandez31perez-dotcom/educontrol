-- =====================================================================
-- EduControl · PRUEBAS MariaDB · 02_pruebas_mariadb.sql
-- Ejecutar SOLO sobre la base educontrol_pruebas (este script la selecciona), después de:
--   1) pruebas/01_base_minima_prueba.sql
--   2) 01_nueva_estructura.sql
--   3) 02_migracion.sql
-- Cada prueba indica el RESULTADO ESPERADO. Las que deben fallar muestran
-- el código de error esperado. Ejecutar en phpMyAdmin o en consola
-- con --force (sin --force la consola se detiene en el primer error esperado).
USE educontrol_pruebas;  -- selección explícita: las pruebas nunca se ejecutan sobre la base real
SELECT DATABASE() AS base_activa;  -- debe mostrar: educontrol_pruebas
-- =====================================================================

-- ---------- Preparación (datos de prueba) ----------
INSERT INTO periodos_academicos (id, anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES
  (1, 2026, 'Primer trimestre', '2026-02-01', '2026-04-30'),
  (2, 2026, 'Segundo trimestre', '2026-05-01', '2026-07-31');
INSERT INTO secciones (id, materia_id, periodo_id, codigo) VALUES
  (1, 1, 1, 'A'), (2, 1, 1, 'B'), (3, 2, 1, 'A'), (4, 1, 2, 'A');
INSERT INTO usuarios (id, nombre_usuario, password, rol) VALUES
  (3, 'carlos.ruiz', 'HASH_FICTICIO', 'PROFESOR'),
  (4, 'maria.lopez', 'HASH_FICTICIO', 'PROFESOR'),
  (5, 'ana.perez', 'HASH_FICTICIO', 'ALUMNO');
INSERT INTO profesores (id, usuario_id, cedula, nombre, apellido) VALUES
  (1, 3, '9-100-100', 'Carlos', 'Ruiz'),
  (2, 4, '9-200-200', 'María', 'López');

-- ---------- 1. Un profesor en varias secciones ----------
-- Esperado: OK, 2 filas (profesor 1 en secciones 1 y 3)
INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1, 1), (1, 3);

-- ---------- 2. Una sección con varios profesores ----------
-- Esperado: OK, la sección 1 queda con los profesores 1 y 2
INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (2, 1);

-- ---------- 3. Un alumno en varias secciones (de materias distintas) ----------
-- Esperado: OK, estudiante 1 en secciones 1 (Matemáticas) y 3 (Español)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (1, 1, 1, 1), (1, 3, 2, 1);

-- ---------- 4. Una sección con varios alumnos ----------
-- Esperado: OK, la sección 1 tiene estudiantes 1 y 3
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (3, 1, 1, 1);

-- ---------- 5. Inscripción activa duplicada ----------
-- Esperado: ERROR 1062 (Duplicate entry ... uq_estudiante_seccion_activa)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (1, 1, 1, 1);

-- ---------- 6. Historial: inscripción RETIRADA previa no bloquea ----------
-- Esperado: OK (estudiante 4 retirado de la sección 1)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id, estado, fecha_fin)
  VALUES (4, 1, 1, 1, 'RETIRADA', '2026-03-15 00:00:00');

-- ---------- 7. Nueva inscripción ACTIVA tras la retirada ----------
-- Esperado: OK (la retirada no cuenta como activa)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (4, 1, 1, 1);

-- ---------- 8. Segunda inscripción ACTIVA del mismo estudiante en la misma sección ----------
-- Esperado: ERROR 1062 (uq_estudiante_seccion_activa)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (4, 1, 1, 1);

-- ---------- 9. Inscripción ACTIVA con fecha de fin ----------
-- Esperado: ERROR 4025 (CONSTRAINT chk_estudiante_seccion_fin)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id, estado, fecha_fin)
  VALUES (3, 2, 1, 1, 'ACTIVA', '2026-06-01 00:00:00');

-- ---------- 10. Inscripción RETIRADA sin fecha de fin ----------
-- Esperado: ERROR 4025 (CONSTRAINT chk_estudiante_seccion_fin)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id, estado)
  VALUES (3, 2, 1, 1, 'RETIRADA');

-- ---------- 11. Asignación profesor-sección duplicada ----------
-- Esperado: ERROR 1062 (PRIMARY, profesor 1 ya asignado a sección 1)
INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1, 1);

-- ---------- 12. Período con fecha de fin anterior al inicio ----------
-- Esperado: ERROR 4025 (CONSTRAINT chk_periodos_fechas)
INSERT INTO periodos_academicos (id, anio_escolar, nombre, fecha_inicio, fecha_fin)
  VALUES (9, 2026, 'Fechas invertidas', '2026-05-01', '2026-04-01');

-- ---------- 13. Período con fechas válidas (inicio = fin) ----------
-- Esperado: OK
INSERT INTO periodos_academicos (id, anio_escolar, nombre, fecha_inicio, fecha_fin)
  VALUES (4, 2026, 'Tercer trimestre', '2026-08-01', '2026-08-01');

-- ---------- 14. Cierre manual de un período ----------
-- Esperado: OK, 1 fila afectada
UPDATE periodos_academicos SET estado = 'CERRADO', fecha_cierre = NOW() WHERE id = 1;

-- ---------- 15. Período CERRADO sin fecha de cierre ----------
-- Esperado: ERROR 4025 (CONSTRAINT chk_periodos_cierre)
UPDATE periodos_academicos SET estado = 'CERRADO', fecha_cierre = NULL WHERE id = 2;

-- ---------- 16. La fecha final NO cierra el período automáticamente ----------
-- Esperado: 'ABIERTO' (fecha_fin ya pasada, pero estado sin cambios)
SELECT id, nombre, estado, fecha_fin FROM periodos_academicos WHERE id = 2;

-- ---------- 17. Período con el mismo año y nombre ----------
-- Esperado: ERROR 1062 (uq_periodos_anio_nombre)
INSERT INTO periodos_academicos (anio_escolar, nombre, fecha_inicio, fecha_fin)
  VALUES (2026, 'Primer trimestre', '2026-02-01', '2026-04-30');

-- ---------- 18. Sección duplicada (misma materia, período y código; sin distinguir mayúsculas) ----------
-- Esperado: ERROR 1062 (uq_secciones_materia_periodo_codigo), porque 'a' = 'A' en utf8mb4_unicode_ci
INSERT INTO secciones (materia_id, periodo_id, codigo) VALUES (1, 1, 'a');

-- ---------- 19. Profesor sin cuenta de usuario ----------
-- Esperado: ERROR 1048 (Column 'usuario_id' cannot be null)
INSERT INTO profesores (usuario_id, cedula, nombre, apellido) VALUES (NULL, '9-300-300', 'Sin', 'Cuenta');

-- ---------- 20. Dos profesores con la misma cuenta ----------
-- Esperado: ERROR 1062 (uq_profesores_usuario)
INSERT INTO profesores (usuario_id, cedula, nombre, apellido) VALUES (3, '9-400-400', 'Otro', 'Ruiz');

-- ---------- 21. Dos estudiantes con la misma cuenta ----------
-- Esperado: la primera actualización OK; la segunda ERROR 1062 (uq_estudiantes_usuario)
UPDATE estudiantes SET usuario_id = 5 WHERE id = 1;
UPDATE estudiantes SET usuario_id = 5 WHERE id = 3;

-- ---------- 22. Inscripción en una sección inexistente ----------
-- Esperado: ERROR 1452 (foreign key fails)
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (1, 999, 1, 1);

-- ---------- 23. Borrar una sección con inscripciones ----------
-- Sección 4: solo tiene inscripciones de alumnos (sin asignaciones de profesor),
-- para que el error venga SOLO de estudiante_seccion (RESTRICT).
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (1, 4, 1, 2);
-- Esperado: ERROR 1451 (cannot delete or update a parent row)
DELETE FROM secciones WHERE id = 4;

-- ---------- 24. Borrar un estudiante con inscripciones ----------
-- Esperado: ERROR 1451 (estudiante_seccion es RESTRICT)
DELETE FROM estudiantes WHERE id = 1;

-- ---------- 25. Borrar un profesor con asignaciones ----------
-- Esperado: ERROR 1451 (profesor_seccion es RESTRICT)
DELETE FROM profesores WHERE id = 1;

-- ---------- 26. Rol no admitido ----------
-- Esperado: ERROR 1265 (Data truncated for column 'rol') en modo estricto
INSERT INTO usuarios (nombre_usuario, password, rol) VALUES ('prueba.rol', 'HASH_FICTICIO', 'SUPERVISOR');

-- ---------- 27. Conservación de datos existentes ----------
-- Esperado: estudiantes=3, materias=5, calificaciones=10, admin_activo=1
SELECT
  (SELECT COUNT(*) FROM estudiantes)    AS estudiantes,
  (SELECT COUNT(*) FROM materias)       AS materias,
  (SELECT COUNT(*) FROM calificaciones) AS calificaciones,
  (SELECT COUNT(*) FROM usuarios WHERE id = 1 AND nombre_usuario = 'admin' AND rol = 'ADMIN') AS admin_activo;

-- ---------- 28. Sin registros huérfanos ----------
-- Esperado: 0 en todas las consultas
SELECT COUNT(*) AS huerfanas_calificaciones FROM calificaciones c
  LEFT JOIN estudiantes e ON e.id = c.estudiante_id LEFT JOIN materias m ON m.id = c.materia_id
  WHERE e.id IS NULL OR m.id IS NULL;
SELECT COUNT(*) AS huerfanas_secciones FROM secciones s
  LEFT JOIN materias m ON m.id = s.materia_id LEFT JOIN periodos_academicos p ON p.id = s.periodo_id
  WHERE m.id IS NULL OR p.id IS NULL;
SELECT COUNT(*) AS huerfanas_profesor_seccion FROM profesor_seccion ps
  LEFT JOIN profesores p ON p.id = ps.profesor_id LEFT JOIN secciones s ON s.id = ps.seccion_id
  WHERE p.id IS NULL OR s.id IS NULL;
SELECT COUNT(*) AS huerfanas_estudiante_seccion FROM estudiante_seccion es
  LEFT JOIN estudiantes e ON e.id = es.estudiante_id LEFT JOIN secciones s ON s.id = es.seccion_id
  WHERE e.id IS NULL OR s.id IS NULL;
SELECT COUNT(*) AS profesores_sin_usuario FROM profesores p LEFT JOIN usuarios u ON u.id = p.usuario_id
  WHERE u.id IS NULL;
