-- =====================================================================
-- EduControl · PRUEBAS v4 · 03_pruebas_v4.sql
-- NO PROBADO EN MARIADB 10.4.32. Escrito para ejecutarse SOLO en educontrol_pruebas.
-- Cada prueba indica el resultado ESPERADO. Anotar el resultado REAL (salida o código de error).
-- Ninguna prueba se da por superada sin ese registro.
-- AVISO: los identificadores de evaluación 21 y 22 que usan las pruebas T-NOA se ASUMEN por el orden de inserción.
--   Antes de ejecutar T-NOA: SELECT id, nombre FROM evaluaciones WHERE seccion_id = 20; y sustituir los identificadores reales.
--
-- PRERREQUISITOS (en la base de PRUEBA):
--   1. 01_base_minima_prueba.sql  (crea educontrol_pruebas con la réplica pre-migración).
--   2. La réplica contiene la cuenta 'consulta' con rol CONSULTA. La migración 02 DEBE fallar mientras exista.
--      Antes de 02, en la base de PRUEBA y solo ahí: DELETE FROM usuarios WHERE nombre_usuario = 'consulta';
--      (Esto no aplica a la base real, donde está prohibido eliminar cuentas sin decisión escrita.)
--   3. 01_nueva_estructura.sql, 02_migracion.sql, 04_sesiones_v4.sql, 05_procedimientos_v4.sql.
--   4. 06_permisos_v4.sql NO es necesario para estas pruebas (se ejecutan como root).
-- =====================================================================
USE educontrol_pruebas;
SELECT DATABASE() AS base_activa;   -- debe ser educontrol_pruebas

-- ---------- T-MIG: la migración funciona con datos y no pierde nada ----------
-- Esperado: 10 calificaciones, todas HEREDADA, sin duplicados; suma de control igual a la anotada antes de 02.
SELECT COUNT(*) AS calificaciones, SUM(origen = 'HEREDADA') AS heredadas FROM calificaciones;

-- ---------- T-SES: sesiones (los tokens son cadenas de prueba; PHP genera 64 caracteres hexadecimales) ----------
-- Preparación: crear sesión para el admin (id 1) y para un profesor de prueba.
INSERT INTO usuarios (id, nombre_usuario, password, rol, estado) VALUES
  (10, 'prof.prueba', REPEAT('h', 60), 'PROFESOR', 'ACTIVO'),
  (11, 'alum.prueba', REPEAT('h', 60), 'ALUMNO', 'ACTIVO');
INSERT INTO profesores (id, usuario_id, cedula, nombre, apellido) VALUES (10, 10, '9-010-010', 'Pedro', 'Prueba');
INSERT INTO estudiantes (id, cedula, nombre, apellido, estado, usuario_id) VALUES (50, '8-050-050', 'Ana', 'Alumna', 'ACTIVO', 11);
CALL sp_sesion_crear(1, 'tok_admin_0000000000000000000000000000000000000000000000000000000000', 4);
CALL sp_sesion_crear(10, 'tok_prof_00000000000000000000000000000000000000000000000000000000000', 4);
CALL sp_sesion_crear(11, 'tok_alum_00000000000000000000000000000000000000000000000000000000000', 4);

-- T-SES-01: token inexistente -> NULL, sin error.   Esperado: NULL
SELECT fn_usuario_de_sesion('token_que_no_existe') AS usuario;
-- T-SES-07: cada token resuelve SOLO a su usuario.  Esperado: 1, 10, 11
SELECT fn_usuario_de_sesion('tok_admin_0000000000000000000000000000000000000000000000000000000000') AS admin_uid,
       fn_usuario_de_sesion('tok_prof_00000000000000000000000000000000000000000000000000000000000') AS prof_uid,
       fn_usuario_de_sesion('tok_alum_00000000000000000000000000000000000000000000000000000000000') AS alum_uid;

-- T-SES-02: sesión revocada -> NULL.                 Esperado: NULL
CALL sp_sesion_revocar('tok_alum_00000000000000000000000000000000000000000000000000000000000');
SELECT fn_usuario_de_sesion('tok_alum_00000000000000000000000000000000000000000000000000000000000') AS revocada;

-- T-SES-06: un ALUMNO llama a un procedimiento de ADMIN -> error PERM (403).   Esperado: PERM|...
CALL sp_admin_crear_periodo('tok_alum_00000000000000000000000000000000000000000000000000000000000', 'Intento de alumno', 2026, 'X', '2026-01-01', '2026-02-01');

-- T-SES-03 (carrera; ejecutar con DOS sesiones de consola): una desactiva la cuenta del profesor
--   mientras la otra ejecuta sp_prof_crear_evaluacion. Esperado: la escritura falla con AUTH o PERM,
--   nunca se escribe con una cuenta inactiva. Registrar ambos resultados.

-- ---------- T-NOA: NO APLICA y pesos ----------
-- Preparación mínima: período, sección, materia, asignación, inscripción y tres evaluaciones.
INSERT INTO periodos_academicos (id, anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES (20, 2027, 'Prueba v4', '2027-02-01', '2027-06-30');
INSERT INTO secciones (id, materia_id, periodo_id, codigo) VALUES (20, 1, 20, 'P');
INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (10, 20);
INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id) VALUES (50, 20, 1, 20);
CALL sp_prof_crear_evaluacion('tok_prof_00000000000000000000000000000000000000000000000000000000000', 20, 'Parcial 1', 30);
CALL sp_prof_crear_evaluacion('tok_prof_00000000000000000000000000000000000000000000000000000000000', 20, 'Parcial 2', 30);
CALL sp_prof_crear_evaluacion('tok_prof_00000000000000000000000000000000000000000000000000000000000', 20, 'Final', 40);
-- T-NOA-01: marcar NO APLICA sin motivo suficiente -> VAL.   Esperado: VAL|...
CALL sp_prof_marcar_no_aplica('tok_prof_00000000000000000000000000000000000000000000000000000000000', 22, 50, 'corto');
-- T-NOA-02: marcar NO APLICA con motivo -> OK.   Esperado: 1 fila en evaluacion_no_aplica y auditoría MARCAR_NO_APLICA
CALL sp_prof_marcar_no_aplica('tok_prof_00000000000000000000000000000000000000000000000000000000000', 21, 50, 'Ausencia justificada con certificado médico');
-- T-NOA-03: registrar nota sobre una evaluación NO APLICA vigente -> REGLA.   Esperado: REGLA|...
CALL sp_prof_registrar_nota('tok_prof_00000000000000000000000000000000000000000000000000000000000', 21, 50, 3.0);

-- ---------- T-CIE: cierre ----------
-- T-CIE-01: cerrar con inscripción ACTIVA -> REGLA.   Esperado: REGLA|Hay inscripciones activas...
CALL sp_admin_cerrar_periodo('tok_admin_0000000000000000000000000000000000000000000000000000000000', 'Cierre de prueba con alumno activo', 20);
-- T-CIE-02: tras finalizar la inscripción, con notas completas, el cierre calcula 4.1 (30 %:4.0, 30 %:3.5, 40 %:4.5 sobre
--   las tres evaluaciones; aquí se registran las notas y se finaliza la inscripción antes del cierre).
--   Esperado: calificaciones ACTUAL para (50, materia 1, periodo 20) con nota 4.1 (si las notas coinciden con el ejemplo).

-- ---------- T-CUE: creación de cuenta y perfil en una transacción ----------
-- T-CUE-01: cédula duplicada -> error de la base; NINGUNA fila nueva en usuarios.
--   Esperado: 1062; contar usuarios antes y después: la diferencia debe ser 0.
SELECT COUNT(*) AS usuarios_antes FROM usuarios;
CALL sp_admin_crear_cuenta_profesor('tok_admin_0000000000000000000000000000000000000000000000000000000000', 'Alta de prueba con cédula repetida', 'prof.dup', REPEAT('h', 60), '9-010-010', 'Otro', 'Prueba', NULL);
SELECT COUNT(*) AS usuarios_despues FROM usuarios;
