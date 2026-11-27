-- =====================================================================
-- EduControl · Etapa E · 05_procedimientos_v4.sql
-- Procedimientos de negocio. TODOS reciben p_token (no hay parámetros de identidad).
-- NO PROBADO EN MARIADB 10.4.32. Requiere 01, 02 y 04 ejecutados antes.
-- Convenciones:
--   * Escrituras: START TRANSACTION; contexto bloqueado; reglas; escritura; auditoría; COMMIT.
--   * Lecturas: contexto sin bloqueo.
--   * Errores: SIGNAL '45000' con texto "CODIGO|mensaje" (AUTH, PERM, REGLA, VAL).
--   * Motivo obligatorio (>= 10 caracteres) en toda operación auditada.
-- Orden de bloqueo (para evitar interbloqueos): usuarios -> periodos -> secciones -> filas hijas.
-- =====================================================================
SELECT DATABASE() AS base_activa;
DELIMITER $$

-- ---------------------------------------------------------------------
-- UTILIDADES INTERNAS
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_motivo(IN p_motivo VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  IF p_motivo IS NULL OR CHAR_LENGTH(TRIM(p_motivo)) < 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|El motivo debe tener al menos 10 caracteres';
  END IF;
END$$

-- Devuelve el perfil de profesor del usuario (o error si no es profesor). Uso interno.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_profesor_de(IN p_uid INT UNSIGNED, OUT p_pid INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SELECT id INTO p_pid FROM profesores WHERE usuario_id = p_uid AND estado = 'ACTIVO';
  IF p_pid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PERM|Perfil de profesor no disponible';
  END IF;
END$$

-- Comprueba que el profesor tiene asignación ACTIVA a la sección. Error genérico si no (no revela existencia).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_exige_asignacion(IN p_uid INT UNSIGNED, IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_pid INT UNSIGNED;
  DECLARE v_n INT;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_profesor_de(p_uid, v_pid);
  SELECT COUNT(*) INTO v_n FROM profesor_seccion
    WHERE profesor_id = v_pid AND seccion_id = p_seccion AND estado = 'ACTIVA';
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PERM|Sección no disponible para su usuario';
  END IF;
END$$

-- Periodo de una sección, debe estar ABIERTO. Uso interno (dentro de una transacción).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_periodo_abierto_de_seccion(IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_est VARCHAR(10);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SELECT p.estado INTO v_est FROM secciones s
    JOIN periodos_academicos p ON p.id = s.periodo_id
    WHERE s.id = p_seccion FOR UPDATE;
  IF v_est IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Sección no encontrada';
  END IF;
  IF v_est <> 'ABIERTO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El período está cerrado';
  END IF;
END$$

-- Registrar o actualizar la nota de una evaluación. Requiere período ABIERTO, inscripción ACTIVA o FINALIZADA,
-- y ausencia de marca NO APLICA vigente. Uso interno: lo llaman los procedimientos con el rol ya comprobado.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_registrar_nota(IN p_uid INT UNSIGNED, IN p_rol VARCHAR(20),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED, IN p_nota DECIMAL(2,1))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_seccion INT UNSIGNED;
  DECLARE v_n INT;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  IF p_nota IS NULL OR p_nota < 1.0 OR p_nota > 5.0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|La nota debe estar entre 1.0 y 5.0';
  END IF;
  SELECT seccion_id INTO v_seccion FROM evaluaciones WHERE id = p_eval;
  IF v_seccion IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Evaluación no encontrada';
  END IF;
  CALL sp_interno_periodo_abierto_de_seccion(v_seccion);
  IF p_rol = 'PROFESOR' THEN
    CALL sp_interno_exige_asignacion(p_uid, v_seccion);
  END IF;
  SELECT COUNT(*) INTO v_n FROM estudiante_seccion
    WHERE seccion_id = v_seccion AND estudiante_id = p_est AND estado IN ('ACTIVA','FINALIZADA');
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno no tiene inscripción vigente en la sección';
  END IF;
  SELECT COUNT(*) INTO v_n FROM evaluacion_no_aplica
    WHERE evaluacion_id = p_eval AND estudiante_id = p_est AND estado = 'VIGENTE';
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La evaluación está marcada NO APLICA para este alumno';
  END IF;
  INSERT INTO notas_evaluacion (evaluacion_id, estudiante_id, nota)
    VALUES (p_eval, p_est, p_nota)
    ON DUPLICATE KEY UPDATE nota = VALUES(nota), actualizada = NOW();
END$$

-- Marca NO APLICA para un alumno en una evaluación. Exige motivo, período ABIERTO, ausencia de nota.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_marcar_no_aplica(IN p_uid INT UNSIGNED, IN p_rol VARCHAR(20),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED, IN p_motivo VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_seccion INT UNSIGNED;
  DECLARE v_n INT;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  SELECT seccion_id INTO v_seccion FROM evaluaciones WHERE id = p_eval;
  IF v_seccion IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Evaluación no encontrada';
  END IF;
  CALL sp_interno_periodo_abierto_de_seccion(v_seccion);
  IF p_rol = 'PROFESOR' THEN
    CALL sp_interno_exige_asignacion(p_uid, v_seccion);
  END IF;
  SELECT COUNT(*) INTO v_n FROM estudiante_seccion
    WHERE seccion_id = v_seccion AND estudiante_id = p_est AND estado IN ('ACTIVA','FINALIZADA');
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno no tiene inscripción vigente en la sección';
  END IF;
  SELECT COUNT(*) INTO v_n FROM notas_evaluacion WHERE evaluacion_id = p_eval AND estudiante_id = p_est;
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Ya existe una nota registrada; no puede marcarse NO APLICA';
  END IF;
  INSERT INTO evaluacion_no_aplica (evaluacion_id, estudiante_id, motivo, marcado_por)
    VALUES (p_eval, p_est, p_motivo, p_uid);
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (p_uid, 'MARCAR_NO_APLICA', 'evaluacion_no_aplica', LAST_INSERT_ID(), p_motivo,
      CONCAT('evaluacion=', p_eval, '; estudiante=', p_est));
END$$

-- Nota final de UNA inscripción, a partir de las evaluaciones aplicables. Upsert en calificaciones (ACTUAL).
-- Uso interno: lo llama la corrección posterior al cierre. Supone que existen notas para todas las aplicables.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_recalcular_final(IN p_est INT UNSIGNED, IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  INSERT INTO calificaciones (estudiante_id, materia_id, seccion_id, periodo_id, origen, nota)
  SELECT es.estudiante_id, s.materia_id, s.id, s.periodo_id, 'ACTUAL',
    FLOOR((2 * SUM(ROUND(n.nota * 10) * ROUND(e.peso * 100)) + SUM(ROUND(e.peso * 100)))
          / (2 * SUM(ROUND(e.peso * 100)))) / 10
  FROM estudiante_seccion es
  JOIN secciones s ON s.id = es.seccion_id
  JOIN evaluaciones e ON e.seccion_id = s.id
  LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = es.estudiante_id AND na.estado = 'VIGENTE'
  JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = es.estudiante_id
  WHERE es.estudiante_id = p_est AND es.seccion_id = p_seccion AND es.estado = 'FINALIZADA' AND na.id IS NULL
  GROUP BY es.estudiante_id, s.materia_id, s.id, s.periodo_id
  ON DUPLICATE KEY UPDATE nota = VALUES(nota), seccion_id = VALUES(seccion_id);
END$$

-- ---------------------------------------------------------------------
-- ADMINISTRACIÓN DE CUENTAS (rol ADMIN)
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_cuenta_profesor(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_nombre_usuario VARCHAR(50), IN p_password_hash VARCHAR(255), IN p_cedula VARCHAR(20),
  IN p_nombre VARCHAR(60), IN p_apellido VARCHAR(60), IN p_correo VARCHAR(120))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_nuevo INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF LENGTH(p_password_hash) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Hash de contraseña no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  INSERT INTO usuarios (nombre_usuario, password, rol, estado)
    VALUES (p_nombre_usuario, p_password_hash, 'PROFESOR', 'ACTIVO');
  SET v_nuevo = LAST_INSERT_ID();
  INSERT INTO profesores (usuario_id, cedula, nombre, apellido, correo, estado)
    VALUES (v_nuevo, p_cedula, p_nombre, p_apellido, p_correo, 'ACTIVO');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_CUENTA', 'usuarios', v_nuevo, p_motivo, CONCAT('rol=PROFESOR; cedula=', p_cedula));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_cuenta_alumno(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_estudiante INT UNSIGNED, IN p_nombre_usuario VARCHAR(50), IN p_password_hash VARCHAR(255))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_nuevo INT UNSIGNED;
  DECLARE v_ya INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF LENGTH(p_password_hash) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Hash de contraseña no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT usuario_id INTO v_ya FROM estudiantes WHERE id = p_estudiante FOR UPDATE;
  IF v_ya IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno ya tiene una cuenta';
  END IF;
  INSERT INTO usuarios (nombre_usuario, password, rol, estado)
    VALUES (p_nombre_usuario, p_password_hash, 'ALUMNO', 'ACTIVO');
  SET v_nuevo = LAST_INSERT_ID();
  UPDATE estudiantes SET usuario_id = v_nuevo WHERE id = p_estudiante;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_CUENTA', 'usuarios', v_nuevo, p_motivo, CONCAT('rol=ALUMNO; estudiante=', p_estudiante));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_cuenta_admin(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_nombre_usuario VARCHAR(50), IN p_password_hash VARCHAR(255))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_nuevo INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF LENGTH(p_password_hash) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Hash de contraseña no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  INSERT INTO usuarios (nombre_usuario, password, rol, estado)
    VALUES (p_nombre_usuario, p_password_hash, 'ADMIN', 'ACTIVO');
  SET v_nuevo = LAST_INSERT_ID();
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_CUENTA', 'usuarios', v_nuevo, p_motivo, 'rol=ADMIN');
  COMMIT;
END$$

-- Desactivar o reactivar una cuenta. Desactivar exige: no ser uno mismo, no dejar sin ADMIN activo,
-- y que el perfil vinculado no tenga relaciones activas. Actualiza cuenta y perfil en la misma transacción.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cambiar_estado_cuenta(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_usuario INT UNSIGNED, IN p_estado VARCHAR(10))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_rol_obj VARCHAR(20);
  DECLARE v_n INT;
  DECLARE v_prof INT UNSIGNED;
  DECLARE v_est INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_estado NOT IN ('ACTIVO','INACTIVO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Estado no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT rol INTO v_rol_obj FROM usuarios WHERE id = p_usuario FOR UPDATE;
  IF v_rol_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Cuenta no encontrada';
  END IF;
  IF p_estado = 'INACTIVO' THEN
    IF p_usuario = v_uid THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|No puede desactivar su propia cuenta';
    END IF;
    IF v_rol_obj = 'ADMIN' THEN
      SELECT COUNT(*) INTO v_n FROM usuarios WHERE rol = 'ADMIN' AND estado = 'ACTIVO' AND id <> p_usuario FOR UPDATE;
      IF v_n = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Es el último ADMIN activo';
      END IF;
    END IF;
    SELECT id INTO v_prof FROM profesores WHERE usuario_id = p_usuario FOR UPDATE;
    IF v_prof IS NOT NULL THEN
      SELECT COUNT(*) INTO v_n FROM profesor_seccion WHERE profesor_id = v_prof AND estado = 'ACTIVA';
      IF v_n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El profesor tiene asignaciones activas';
      END IF;
      UPDATE profesores SET estado = 'INACTIVO' WHERE id = v_prof;
    END IF;
    SELECT id INTO v_est FROM estudiantes WHERE usuario_id = p_usuario FOR UPDATE;
    IF v_est IS NOT NULL THEN
      SELECT COUNT(*) INTO v_n FROM estudiante_seccion WHERE estudiante_id = v_est AND estado = 'ACTIVA';
      IF v_n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno tiene inscripciones activas';
      END IF;
      UPDATE estudiantes SET estado = 'INACTIVO' WHERE id = v_est;
    END IF;
  END IF;
  UPDATE usuarios SET estado = p_estado WHERE id = p_usuario;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CAMBIAR_ESTADO_USUARIO', 'usuarios', p_usuario, p_motivo, CONCAT('estado=', p_estado));
  COMMIT;
END$$

-- Asignar el rol ADMIN a una cuenta sin perfil. Cambiar a PROFESOR o ALUMNO NO se permite aquí:
-- esos roles exigen su perfil y se crean con sus procedimientos (evita cuentas sin perfil).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cambiar_rol_cuenta(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_usuario INT UNSIGNED, IN p_rol VARCHAR(20))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_rol_obj VARCHAR(20);
  DECLARE v_n INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_rol <> 'ADMIN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Solo se puede asignar el rol ADMIN; PROFESOR y ALUMNO se crean con su perfil';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT rol INTO v_rol_obj FROM usuarios WHERE id = p_usuario FOR UPDATE;
  IF v_rol_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Cuenta no encontrada';
  END IF;
  IF v_rol_obj <> 'ADMIN' THEN
    SELECT COUNT(*) INTO v_n FROM profesores WHERE usuario_id = p_usuario;
    SELECT v_n + COUNT(*) INTO v_n FROM estudiantes WHERE usuario_id = p_usuario;
    IF v_n > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La cuenta tiene un perfil vinculado; no se puede cambiar su rol';
    END IF;
    UPDATE usuarios SET rol = 'ADMIN' WHERE id = p_usuario;
    INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
      VALUES (v_uid, 'ASIGNAR_ROL', 'usuarios', p_usuario, p_motivo, 'rol=ADMIN');
  END IF;
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_restablecer_password(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_usuario INT UNSIGNED, IN p_password_hash VARCHAR(255))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_obj VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF LENGTH(p_password_hash) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Hash de contraseña no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT rol INTO v_obj FROM usuarios WHERE id = p_usuario FOR UPDATE;
  IF v_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Cuenta no encontrada';
  END IF;
  UPDATE usuarios SET password = p_password_hash WHERE id = p_usuario;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'RESTABLECER_PASSWORD', 'usuarios', p_usuario, p_motivo, 'contraseña restablecida (valor no registrado)');
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- ESTUDIANTES Y PROFESORES (ADMIN)
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_estudiante(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_cedula VARCHAR(20), IN p_nombre VARCHAR(60), IN p_apellido VARCHAR(60))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  INSERT INTO estudiantes (cedula, nombre, apellido, estado) VALUES (p_cedula, p_nombre, p_apellido, 'ACTIVO');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_PERSONA', 'estudiantes', LAST_INSERT_ID(), p_motivo, CONCAT('cedula=', p_cedula));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cambiar_estado_estudiante(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_estudiante INT UNSIGNED, IN p_estado VARCHAR(10))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_n INT;
  DECLARE v_obj INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_estado NOT IN ('ACTIVO','INACTIVO','RETIRADO','GRADUADO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Estado no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT id INTO v_obj FROM estudiantes WHERE id = p_estudiante FOR UPDATE;
  IF v_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Alumno no encontrado';
  END IF;
  IF p_estado <> 'ACTIVO' THEN
    SELECT COUNT(*) INTO v_n FROM estudiante_seccion WHERE estudiante_id = p_estudiante AND estado = 'ACTIVA';
    IF v_n > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno tiene inscripciones activas';
    END IF;
  END IF;
  UPDATE estudiantes SET estado = p_estado WHERE id = p_estudiante;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CAMBIAR_ESTADO_PERSONA', 'estudiantes', p_estudiante, p_motivo, CONCAT('estado=', p_estado));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cambiar_estado_profesor(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_profesor INT UNSIGNED, IN p_estado VARCHAR(10))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_n INT;
  DECLARE v_obj INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_estado NOT IN ('ACTIVO','INACTIVO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Estado no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT id INTO v_obj FROM profesores WHERE id = p_profesor FOR UPDATE;
  IF v_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Profesor no encontrado';
  END IF;
  IF p_estado = 'INACTIVO' THEN
    SELECT COUNT(*) INTO v_n FROM profesor_seccion WHERE profesor_id = p_profesor AND estado = 'ACTIVA';
    IF v_n > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El profesor tiene asignaciones activas';
    END IF;
  END IF;
  UPDATE profesores SET estado = p_estado WHERE id = p_profesor;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CAMBIAR_ESTADO_PERSONA', 'profesores', p_profesor, p_motivo, CONCAT('estado=', p_estado));
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- PERÍODOS (ADMIN): crear, cerrar, reabrir
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_periodo(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_anio SMALLINT UNSIGNED, IN p_nombre VARCHAR(60), IN p_inicio DATE, IN p_fin DATE)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_fin < p_inicio THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|La fecha de fin es anterior a la de inicio';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  INSERT INTO periodos_academicos (anio_escolar, nombre, fecha_inicio, fecha_fin, estado)
    VALUES (p_anio, p_nombre, p_inicio, p_fin, 'ABIERTO');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_PERIODO', 'periodos_academicos', LAST_INSERT_ID(), p_motivo, CONCAT(p_anio, ' ', p_nombre));
  COMMIT;
END$$

-- Cierre: exige período ABIERTO, cero inscripciones/asignaciones ACTIVA, pesos = 100 en secciones con
-- inscripciones finalizadas, cero calificaciones pendientes y cero pendientes abiertos. Luego calcula las
-- notas finales (ACTUAL) de las inscripciones FINALIZADA y cierra el período. Todo en una transacción.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cerrar_periodo(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_periodo INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE v_n INT;
  DECLARE v_calc INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est FROM periodos_academicos WHERE id = p_periodo FOR UPDATE;
  IF v_est IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Período no encontrado';
  END IF;
  IF v_est <> 'ABIERTO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El período ya está cerrado';
  END IF;
  SELECT COUNT(*) INTO v_n FROM estudiante_seccion WHERE periodo_id = p_periodo AND estado = 'ACTIVA';
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Hay inscripciones activas en el período; finalícelas antes';
  END IF;
  SELECT COUNT(*) INTO v_n FROM profesor_seccion ps JOIN secciones s ON s.id = ps.seccion_id
    WHERE s.periodo_id = p_periodo AND ps.estado = 'ACTIVA';
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Hay asignaciones activas en el período; finalícelas antes';
  END IF;
  SELECT COUNT(*) INTO v_n FROM (
    SELECT s.id FROM secciones s
    JOIN estudiante_seccion es ON es.seccion_id = s.id AND es.estado = 'FINALIZADA'
    WHERE s.periodo_id = p_periodo
    GROUP BY s.id
    HAVING COALESCE((SELECT SUM(e.peso) FROM evaluaciones e WHERE e.seccion_id = s.id), 0) <> 100) x;
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Hay secciones cuyas evaluaciones no suman 100 %';
  END IF;
  SELECT COUNT(*) INTO v_n FROM (
    SELECT es.id FROM estudiante_seccion es
    JOIN secciones s ON s.id = es.seccion_id
    JOIN evaluaciones e ON e.seccion_id = s.id
    LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = es.estudiante_id AND na.estado = 'VIGENTE'
    LEFT JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = es.estudiante_id
    WHERE s.periodo_id = p_periodo AND es.estado = 'FINALIZADA'
    GROUP BY es.id
    HAVING SUM(CASE WHEN na.id IS NULL AND n.id IS NULL THEN 1 ELSE 0 END) > 0
        OR (COUNT(e.id) > 0 AND COUNT(na.id) = COUNT(e.id))) x;
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Hay calificaciones pendientes (sin nota o todas NO APLICA)';
  END IF;
  SELECT COUNT(*) INTO v_n FROM pendientes_calificacion WHERE periodo_id = p_periodo AND estado = 'ABIERTO';
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Hay pendientes de calificación sin resolver';
  END IF;
  SELECT COUNT(*) INTO v_n FROM (
    SELECT es.estudiante_id, s.materia_id FROM estudiante_seccion es
    JOIN secciones s ON s.id = es.seccion_id
    WHERE s.periodo_id = p_periodo AND es.estado = 'FINALIZADA'
    GROUP BY es.estudiante_id, s.materia_id HAVING COUNT(*) > 1) x;
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Un alumno tiene dos inscripciones finalizadas en la misma materia';
  END IF;
  INSERT INTO calificaciones (estudiante_id, materia_id, seccion_id, periodo_id, origen, nota)
  SELECT es.estudiante_id, s.materia_id, s.id, s.periodo_id, 'ACTUAL',
    FLOOR((2 * SUM(ROUND(n.nota * 10) * ROUND(e.peso * 100)) + SUM(ROUND(e.peso * 100)))
          / (2 * SUM(ROUND(e.peso * 100)))) / 10
  FROM estudiante_seccion es
  JOIN secciones s ON s.id = es.seccion_id
  JOIN evaluaciones e ON e.seccion_id = s.id
  LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = es.estudiante_id AND na.estado = 'VIGENTE'
  JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = es.estudiante_id
  WHERE s.periodo_id = p_periodo AND es.estado = 'FINALIZADA' AND na.id IS NULL
  GROUP BY es.estudiante_id, s.materia_id, s.id, s.periodo_id
  ON DUPLICATE KEY UPDATE nota = VALUES(nota), seccion_id = VALUES(seccion_id);
  SELECT COUNT(*) INTO v_calc FROM calificaciones WHERE periodo_id = p_periodo AND origen = 'ACTUAL';
  UPDATE periodos_academicos SET estado = 'CERRADO', fecha_cierre = NOW() WHERE id = p_periodo;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CERRAR_PERIODO', 'periodos_academicos', p_periodo, p_motivo, CONCAT('notas_finales=', v_calc));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_reabrir_periodo(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_periodo INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE v_cierre DATETIME;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado, fecha_cierre INTO v_est, v_cierre FROM periodos_academicos WHERE id = p_periodo FOR UPDATE;
  IF v_est IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Período no encontrado';
  END IF;
  IF v_est <> 'CERRADO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Solo se puede reabrir un período cerrado';
  END IF;
  UPDATE periodos_academicos SET estado = 'ABIERTO', fecha_cierre = NULL WHERE id = p_periodo;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'REABRIR_PERIODO', 'periodos_academicos', p_periodo, p_motivo,
      CONCAT('fecha_cierre_anterior=', IFNULL(DATE_FORMAT(v_cierre, '%Y-%m-%d %H:%i:%s'), 'NULL')));
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- SECCIONES, ASIGNACIONES E INSCRIPCIONES (ADMIN)
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_seccion(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_materia INT UNSIGNED, IN p_periodo INT UNSIGNED, IN p_codigo VARCHAR(10))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est FROM periodos_academicos WHERE id = p_periodo FOR UPDATE;
  IF v_est IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Período no encontrado';
  END IF;
  IF v_est <> 'ABIERTO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El período está cerrado';
  END IF;
  INSERT INTO secciones (materia_id, periodo_id, codigo, estado) VALUES (p_materia, p_periodo, p_codigo, 'ACTIVA');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_SECCION', 'secciones', LAST_INSERT_ID(), p_motivo, CONCAT('codigo=', p_codigo));
  COMMIT;
END$$

-- Desactivar una sección exige que no tenga asignaciones ni inscripciones activas (R-2).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_cambiar_estado_seccion(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_seccion INT UNSIGNED, IN p_estado VARCHAR(10))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_obj INT UNSIGNED;
  DECLARE v_n INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_estado NOT IN ('ACTIVA','INACTIVA') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Estado no válido';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT id INTO v_obj FROM secciones WHERE id = p_seccion FOR UPDATE;
  IF v_obj IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Sección no encontrada';
  END IF;
  IF p_estado = 'INACTIVA' THEN
    SELECT (SELECT COUNT(*) FROM profesor_seccion WHERE seccion_id = p_seccion AND estado = 'ACTIVA')
         + (SELECT COUNT(*) FROM estudiante_seccion WHERE seccion_id = p_seccion AND estado = 'ACTIVA') INTO v_n;
    IF v_n > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La sección tiene asignaciones o inscripciones activas';
    END IF;
  END IF;
  UPDATE secciones SET estado = p_estado WHERE id = p_seccion;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CAMBIAR_ESTADO_SECCION', 'secciones', p_seccion, p_motivo, CONCAT('estado=', p_estado));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_asignar_profesor(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_profesor INT UNSIGNED, IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est_prof VARCHAR(10);
  DECLARE v_est_sec VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est_prof FROM profesores WHERE id = p_profesor FOR UPDATE;
  IF v_est_prof IS NULL OR v_est_prof <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El profesor no está activo';
  END IF;
  SELECT s.estado INTO v_est_sec FROM secciones s JOIN periodos_academicos p ON p.id = s.periodo_id
    WHERE s.id = p_seccion FOR UPDATE;
  IF v_est_sec IS NULL OR v_est_sec <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La sección no está activa';
  END IF;
  CALL sp_interno_periodo_abierto_de_seccion(p_seccion);
  INSERT INTO profesor_seccion (profesor_id, seccion_id, estado) VALUES (p_profesor, p_seccion, 'ACTIVA');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'ASIGNAR_PROFESOR', 'profesor_seccion', LAST_INSERT_ID(), p_motivo,
      CONCAT('profesor=', p_profesor, '; seccion=', p_seccion));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_finalizar_asignacion(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_asignacion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est FROM profesor_seccion WHERE id = p_asignacion FOR UPDATE;
  IF v_est IS NULL OR v_est <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La asignación no está activa';
  END IF;
  UPDATE profesor_seccion SET estado = 'FINALIZADA', fecha_fin = NOW() WHERE id = p_asignacion;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'FINALIZAR_RELACION', 'profesor_seccion', p_asignacion, p_motivo, 'asignacion finalizada');
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_inscribir_estudiante(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_estudiante INT UNSIGNED, IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est_al VARCHAR(10);
  DECLARE v_est_sec VARCHAR(10);
  DECLARE v_materia INT UNSIGNED;
  DECLARE v_periodo INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est_al FROM estudiantes WHERE id = p_estudiante FOR UPDATE;
  IF v_est_al IS NULL OR v_est_al <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno no está activo';
  END IF;
  SELECT estado, materia_id, periodo_id INTO v_est_sec, v_materia, v_periodo FROM secciones WHERE id = p_seccion FOR UPDATE;
  IF v_est_sec IS NULL OR v_est_sec <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La sección no está activa';
  END IF;
  CALL sp_interno_periodo_abierto_de_seccion(p_seccion);
  INSERT INTO estudiante_seccion (estudiante_id, seccion_id, materia_id, periodo_id, estado)
    VALUES (p_estudiante, p_seccion, v_materia, v_periodo, 'ACTIVA');
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'INSCRIBIR_ESTUDIANTE', 'estudiante_seccion', LAST_INSERT_ID(), p_motivo,
      CONCAT('estudiante=', p_estudiante, '; seccion=', p_seccion));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_finalizar_inscripcion(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_inscripcion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est FROM estudiante_seccion WHERE id = p_inscripcion FOR UPDATE;
  IF v_est IS NULL OR v_est <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La inscripción no está activa';
  END IF;
  UPDATE estudiante_seccion SET estado = 'FINALIZADA', fecha_fin = NOW() WHERE id = p_inscripcion;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'FINALIZAR_RELACION', 'estudiante_seccion', p_inscripcion, p_motivo, 'inscripción finalizada');
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- EVALUACIONES, NOTAS, NO APLICA (ADMIN; los equivalentes de PROFESOR están más abajo)
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_crear_evaluacion(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_seccion INT UNSIGNED, IN p_nombre VARCHAR(120), IN p_peso DECIMAL(5,2))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_suma DECIMAL(7,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  CALL sp_interno_periodo_abierto_de_seccion(p_seccion);
  SELECT COALESCE(SUM(peso), 0) INTO v_suma FROM evaluaciones WHERE seccion_id = p_seccion;
  IF v_suma + p_peso > 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Las evaluaciones superarían el 100 %';
  END IF;
  INSERT INTO evaluaciones (seccion_id, nombre, peso) VALUES (p_seccion, p_nombre, p_peso);
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_EVALUACION', 'evaluaciones', LAST_INSERT_ID(), p_motivo, CONCAT('seccion=', p_seccion));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_registrar_nota(IN p_token VARCHAR(128),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED, IN p_nota DECIMAL(2,1))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  CALL sp_interno_registrar_nota(v_uid, 'ADMIN', p_eval, p_est, p_nota);
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_marcar_no_aplica(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  CALL sp_interno_marcar_no_aplica(v_uid, 'ADMIN', p_eval, p_est, p_motivo);
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_revocar_no_aplica(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_no_aplica BIGINT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado INTO v_est FROM evaluacion_no_aplica WHERE id = p_no_aplica FOR UPDATE;
  IF v_est IS NULL OR v_est <> 'VIGENTE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La marca NO APLICA no está vigente';
  END IF;
  UPDATE evaluacion_no_aplica SET estado = 'REVOCADA', revocado_por = v_uid,
    fecha_revocacion = NOW(), motivo_revocacion = p_motivo WHERE id = p_no_aplica;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'REVOCAR_NO_APLICA', 'evaluacion_no_aplica', p_no_aplica, p_motivo, 'marca revocada');
  COMMIT;
END$$

-- Corregir una nota DESPUÉS del cierre: cambia la nota de evaluación, recalcula la nota final y audita ambos valores.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_corregir_nota(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED, IN p_nueva DECIMAL(2,1))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_seccion INT UNSIGNED;
  DECLARE v_periodo INT UNSIGNED;
  DECLARE v_est VARCHAR(10);
  DECLARE v_vieja DECIMAL(2,1);
  DECLARE v_final_vieja DECIMAL(2,1);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  IF p_nueva < 1.0 OR p_nueva > 5.0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|La nota debe estar entre 1.0 y 5.0';
  END IF;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT e.seccion_id, p.estado, n.nota INTO v_seccion, v_est, v_vieja
    FROM evaluaciones e
    JOIN secciones s ON s.id = e.seccion_id
    JOIN periodos_academicos p ON p.id = s.periodo_id
    JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = p_est
    WHERE e.id = p_eval FOR UPDATE;
  IF v_seccion IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|No existe una nota registrada para corregir';
  END IF;
  IF v_est <> 'CERRADO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La corrección posterior solo aplica a períodos cerrados';
  END IF;
  SELECT periodo_id INTO v_periodo FROM secciones WHERE id = v_seccion;
  SELECT nota INTO v_final_vieja FROM calificaciones
    WHERE estudiante_id = p_est AND periodo_id = v_periodo AND origen = 'ACTUAL'
      AND materia_id = (SELECT materia_id FROM secciones WHERE id = v_seccion) FOR UPDATE;
  UPDATE notas_evaluacion SET nota = p_nueva, actualizada = NOW() WHERE evaluacion_id = p_eval AND estudiante_id = p_est;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CORREGIR_EVALUACION', 'notas_evaluacion', p_eval, p_motivo,
      CONCAT('estudiante=', p_est, '; anterior=', v_vieja, '; nueva=', p_nueva));
  CALL sp_interno_recalcular_final(p_est, v_seccion);
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CORREGIR_CALIFICACION', 'calificaciones', p_est, p_motivo,
      CONCAT('nota_final_anterior=', IFNULL(v_final_vieja, 'NULL'), '; seccion=', v_seccion));
  COMMIT;
END$$

-- Clasificar una nota histórica: solo ADMIN, período ABIERTO, inscripción del alumno en esa sección,
-- materia coherente, sin nota final ACTUAL en conflicto. Nunca se borra.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_clasificar_heredada(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_calif INT UNSIGNED, IN p_seccion INT UNSIGNED, IN p_periodo INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_origen VARCHAR(10);
  DECLARE v_est_alumno INT UNSIGNED;
  DECLARE v_materia INT UNSIGNED;
  DECLARE v_mat_sec INT UNSIGNED;
  DECLARE v_per_sec INT UNSIGNED;
  DECLARE v_n INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT origen, estudiante_id, materia_id INTO v_origen, v_est_alumno, v_materia
    FROM calificaciones WHERE id = p_calif FOR UPDATE;
  IF v_origen IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Calificación no encontrada';
  END IF;
  IF v_origen <> 'HEREDADA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Solo se clasifican calificaciones históricas';
  END IF;
  SELECT materia_id, periodo_id INTO v_mat_sec, v_per_sec FROM secciones WHERE id = p_seccion FOR UPDATE;
  IF v_mat_sec IS NULL OR v_per_sec <> p_periodo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La sección no pertenece al período indicado';
  END IF;
  IF v_mat_sec <> v_materia THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|La materia de la sección no coincide con la de la nota';
  END IF;
  CALL sp_interno_periodo_abierto_de_seccion(p_seccion);
  SELECT COUNT(*) INTO v_n FROM estudiante_seccion
    WHERE seccion_id = p_seccion AND estudiante_id = v_est_alumno AND estado IN ('ACTIVA','FINALIZADA');
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno no tiene inscripción en esa sección';
  END IF;
  SELECT COUNT(*) INTO v_n FROM calificaciones
    WHERE estudiante_id = v_est_alumno AND materia_id = v_materia AND periodo_id = p_periodo AND origen = 'ACTUAL';
  IF v_n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Ya existe una nota final para ese alumno, materia y período';
  END IF;
  UPDATE calificaciones SET seccion_id = p_seccion, periodo_id = p_periodo, origen = 'ACTUAL' WHERE id = p_calif;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CLASIFICAR_CALIFICACION', 'calificaciones', p_calif, p_motivo,
      CONCAT('origen: HEREDADA->ACTUAL; seccion=', p_seccion, '; periodo=', p_periodo));
  COMMIT;
END$$

-- Detecta calificaciones pendientes de un período y las registra (idempotente). Solo lectura de negocio.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_detectar_pendientes(IN p_token VARCHAR(128), IN p_periodo INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  INSERT INTO pendientes_calificacion (periodo_id, seccion_id, estudiante_id, tipo)
  SELECT p_periodo, es.seccion_id, es.estudiante_id,
    CASE WHEN SUM(CASE WHEN na.id IS NULL AND n.id IS NULL THEN 1 ELSE 0 END) > 0 THEN 'SIN_NOTA' ELSE 'TODAS_NO_APLICA' END
  FROM estudiante_seccion es
  JOIN secciones s ON s.id = es.seccion_id
  JOIN evaluaciones e ON e.seccion_id = s.id
  LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = es.estudiante_id AND na.estado = 'VIGENTE'
  LEFT JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = es.estudiante_id
  WHERE s.periodo_id = p_periodo AND es.estado = 'FINALIZADA'
  GROUP BY es.id, es.seccion_id, es.estudiante_id
  HAVING SUM(CASE WHEN na.id IS NULL AND n.id IS NULL THEN 1 ELSE 0 END) > 0
      OR (COUNT(e.id) > 0 AND COUNT(na.id) = COUNT(e.id))
  ON DUPLICATE KEY UPDATE id = id;
  COMMIT;
END$$

-- Resolver un pendiente: REVOCAR_NO_APLICA (revoca las marcas del alumno en la sección),
-- EXCLUIR_ALUMNO (la inscripción finalizada pasa a RETIRADA: no recibe nota final) o
-- REGISTRAR_NOTA (registra la nota de una evaluación concreta).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_admin_resolver_pendiente(IN p_token VARCHAR(128), IN p_motivo VARCHAR(500),
  IN p_pendiente INT UNSIGNED, IN p_resolucion VARCHAR(30), IN p_eval INT UNSIGNED, IN p_nota DECIMAL(2,1))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_est VARCHAR(10);
  DECLARE v_seccion INT UNSIGNED;
  DECLARE v_alumno INT UNSIGNED;
  DECLARE v_filas INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_motivo(p_motivo);
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'ADMIN', v_uid, v_rol);
  SELECT estado, seccion_id, estudiante_id INTO v_est, v_seccion, v_alumno
    FROM pendientes_calificacion WHERE id = p_pendiente FOR UPDATE;
  IF v_est IS NULL OR v_est <> 'ABIERTO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El pendiente no está abierto';
  END IF;
  IF p_resolucion = 'REVOCAR_NO_APLICA' THEN
    UPDATE evaluacion_no_aplica na JOIN evaluaciones e ON e.id = na.evaluacion_id
      SET na.estado = 'REVOCADA', na.revocado_por = v_uid, na.fecha_revocacion = NOW(), na.motivo_revocacion = p_motivo
      WHERE e.seccion_id = v_seccion AND na.estudiante_id = v_alumno AND na.estado = 'VIGENTE';
    SET v_filas = ROW_COUNT();
    IF v_filas = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|No hay marcas NO APLICA que revocar';
    END IF;
  ELSEIF p_resolucion = 'EXCLUIR_ALUMNO' THEN
    UPDATE estudiante_seccion SET estado = 'RETIRADA', fecha_fin = NOW()
      WHERE seccion_id = v_seccion AND estudiante_id = v_alumno AND estado = 'FINALIZADA';
    IF ROW_COUNT() = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|No hay inscripción finalizada que excluir';
    END IF;
  ELSEIF p_resolucion = 'REGISTRAR_NOTA' THEN
    CALL sp_interno_registrar_nota(v_uid, 'ADMIN', p_eval, v_alumno, p_nota);
  ELSE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Resolución no válida';
  END IF;
  UPDATE pendientes_calificacion SET estado = 'RESUELTO', resolucion = p_resolucion, resuelto_por = v_uid,
    fecha_resolucion = NOW(), motivo_resolucion = p_motivo WHERE id = p_pendiente;
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'RESOLVER_PENDIENTE', 'pendientes_calificacion', p_pendiente, p_motivo, p_resolucion);
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- PROFESOR: lecturas y escrituras propias (rol PROFESOR; ownership por sección)
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_mis_secciones(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_pid INT UNSIGNED;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_profesor_de(v_uid, v_pid);
  SELECT s.id AS seccion_id, s.codigo, m.nombre AS materia, p.id AS periodo_id, p.nombre AS periodo, p.estado AS periodo_estado
  FROM profesor_seccion ps
  JOIN secciones s ON s.id = ps.seccion_id
  JOIN materias m ON m.id = s.materia_id
  JOIN periodos_academicos p ON p.id = s.periodo_id
  WHERE ps.profesor_id = v_pid AND ps.estado = 'ACTIVA';
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_estudiantes_seccion(IN p_token VARCHAR(128), IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT e.id AS estudiante_id, e.cedula, e.nombre, e.apellido, es.estado AS inscripcion_estado
  FROM estudiante_seccion es JOIN estudiantes e ON e.id = es.estudiante_id
  WHERE es.seccion_id = p_seccion AND es.estado IN ('ACTIVA','FINALIZADA')
  ORDER BY e.apellido, e.nombre;
END$$

-- Evaluaciones de la sección con la nota (o NO APLICA) de cada alumno inscrito.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_calificaciones_seccion(IN p_token VARCHAR(128), IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT e.id AS evaluacion_id, e.nombre AS evaluacion, e.peso, es.estudiante_id, st.apellido, st.nombre,
    n.nota, CASE WHEN na.id IS NULL THEN 0 ELSE 1 END AS no_aplica, na.motivo AS no_aplica_motivo
  FROM evaluaciones e
  JOIN estudiante_seccion es ON es.seccion_id = e.seccion_id AND es.estado IN ('ACTIVA','FINALIZADA')
  JOIN estudiantes st ON st.id = es.estudiante_id
  LEFT JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = es.estudiante_id
  LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = es.estudiante_id AND na.estado = 'VIGENTE'
  WHERE e.seccion_id = p_seccion
  ORDER BY e.id, st.apellido, st.nombre;
END$$

-- Notas finales de la sección (calculadas en el cierre) y ranking dentro de la sección.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_notas_finales(IN p_token VARCHAR(128), IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT c.estudiante_id, st.apellido, st.nombre, c.nota,
    ROW_NUMBER() OVER (ORDER BY c.nota DESC, st.apellido, st.nombre) AS posicion
  FROM calificaciones c JOIN estudiantes st ON st.id = c.estudiante_id
  WHERE c.seccion_id = p_seccion AND c.origen = 'ACTUAL';
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_crear_evaluacion(IN p_token VARCHAR(128), IN p_seccion INT UNSIGNED,
  IN p_nombre VARCHAR(120), IN p_peso DECIMAL(5,2))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_suma DECIMAL(7,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_periodo_abierto_de_seccion(p_seccion);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT COALESCE(SUM(peso), 0) INTO v_suma FROM evaluaciones WHERE seccion_id = p_seccion;
  IF v_suma + p_peso > 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|Las evaluaciones superarían el 100 %';
  END IF;
  INSERT INTO evaluaciones (seccion_id, nombre, peso) VALUES (p_seccion, p_nombre, p_peso);
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'CREAR_EVALUACION', 'evaluaciones', LAST_INSERT_ID(), 'Alta de evaluación por el profesor', CONCAT('seccion=', p_seccion));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_registrar_nota(IN p_token VARCHAR(128),
  IN p_eval INT UNSIGNED, IN p_est INT UNSIGNED, IN p_nota DECIMAL(2,1))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_registrar_nota(v_uid, 'PROFESOR', p_eval, p_est, p_nota);
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_marcar_no_aplica(IN p_token VARCHAR(128), IN p_eval INT UNSIGNED,
  IN p_est INT UNSIGNED, IN p_motivo VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_marcar_no_aplica(v_uid, 'PROFESOR', p_eval, p_est, p_motivo);
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_registrar_observacion(IN p_token VARCHAR(128),
  IN p_est INT UNSIGNED, IN p_seccion INT UNSIGNED, IN p_texto VARCHAR(1000))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE v_n INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  START TRANSACTION;
  CALL sp_interno_contexto_bloqueado(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT COUNT(*) INTO v_n FROM estudiante_seccion
    WHERE seccion_id = p_seccion AND estudiante_id = p_est AND estado IN ('ACTIVA','FINALIZADA');
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGLA|El alumno no tiene inscripción en la sección';
  END IF;
  INSERT INTO observaciones (estudiante_id, seccion_id, autor_usuario_id, texto) VALUES (p_est, p_seccion, v_uid, p_texto);
  INSERT INTO auditoria_academica (usuario_id, accion, entidad, entidad_id, motivo, detalle)
    VALUES (v_uid, 'REGISTRAR_OBSERVACION', 'observaciones', LAST_INSERT_ID(), 'Observación registrada por el profesor', CONCAT('estudiante=', p_est));
  COMMIT;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_prof_observaciones_seccion(IN p_token VARCHAR(128), IN p_seccion INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'PROFESOR', v_uid, v_rol);
  CALL sp_interno_exige_asignacion(v_uid, p_seccion);
  SELECT o.id, o.estudiante_id, st.apellido, st.nombre, o.texto, o.fecha
  FROM observaciones o JOIN estudiantes st ON st.id = o.estudiante_id
  WHERE o.seccion_id = p_seccion
  ORDER BY o.fecha DESC;
END$$

-- ---------------------------------------------------------------------
-- ALUMNO: solo sus propios datos. Ningún parámetro identifica al alumno: se resuelve desde el token.
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_alum_mis_inscripciones(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'ALUMNO', v_uid, v_rol);
  SELECT es.id AS inscripcion_id, s.codigo, m.nombre AS materia, p.nombre AS periodo, es.estado
  FROM estudiante_seccion es
  JOIN estudiantes st ON st.id = es.estudiante_id
  JOIN secciones s ON s.id = es.seccion_id
  JOIN materias m ON m.id = s.materia_id
  JOIN periodos_academicos p ON p.id = s.periodo_id
  WHERE st.usuario_id = v_uid;
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_alum_mis_resultados(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'ALUMNO', v_uid, v_rol);
  SELECT e.nombre AS evaluacion, e.peso, s.codigo AS seccion, m.nombre AS materia, p.nombre AS periodo,
    n.nota, CASE WHEN na.id IS NULL THEN 0 ELSE 1 END AS no_aplica
  FROM estudiantes st
  JOIN estudiante_seccion es ON es.estudiante_id = st.id
  JOIN secciones s ON s.id = es.seccion_id
  JOIN materias m ON m.id = s.materia_id
  JOIN periodos_academicos p ON p.id = s.periodo_id
  JOIN evaluaciones e ON e.seccion_id = s.id
  LEFT JOIN notas_evaluacion n ON n.evaluacion_id = e.id AND n.estudiante_id = st.id
  LEFT JOIN evaluacion_no_aplica na ON na.evaluacion_id = e.id AND na.estudiante_id = st.id AND na.estado = 'VIGENTE'
  WHERE st.usuario_id = v_uid AND es.estado IN ('ACTIVA','FINALIZADA');
END$$

CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_alum_mis_finales(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'ALUMNO', v_uid, v_rol);
  SELECT c.origen, c.periodo_id, p.nombre AS periodo, m.nombre AS materia, c.nota
  FROM calificaciones c
  JOIN estudiantes st ON st.id = c.estudiante_id
  JOIN materias m ON m.id = c.materia_id
  LEFT JOIN periodos_academicos p ON p.id = c.periodo_id
  WHERE st.usuario_id = v_uid;
END$$

-- Promedios por período (solo los propios). El histórico aparece aparte, nunca mezclado con períodos.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_alum_promedios(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'ALUMNO', v_uid, v_rol);
  SELECT 'PERIODO' AS ambito, p.id AS periodo_id, p.nombre AS periodo, COUNT(*) AS materias, ROUND(AVG(c.nota), 2) AS promedio
  FROM calificaciones c
  JOIN estudiantes st ON st.id = c.estudiante_id
  JOIN periodos_academicos p ON p.id = c.periodo_id
  WHERE st.usuario_id = v_uid AND c.origen = 'ACTUAL'
  GROUP BY p.id, p.nombre
  UNION ALL
  SELECT 'HISTORICO', NULL, 'Histórico (sin período)', COUNT(*), ROUND(AVG(c.nota), 2)
  FROM calificaciones c
  JOIN estudiantes st ON st.id = c.estudiante_id
  WHERE st.usuario_id = v_uid AND c.origen = 'HEREDADA';
END$$

-- ---------------------------------------------------------------------
-- COMÚN
-- ---------------------------------------------------------------------
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_comun_mi_perfil(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  CALL sp_interno_contexto_lectura(p_token, 'ADMIN,PROFESOR,ALUMNO', v_uid, v_rol);
  SELECT u.id AS usuario_id, u.nombre_usuario, u.rol,
    p.id AS profesor_id, e.id AS estudiante_id
  FROM usuarios u
  LEFT JOIN profesores p ON p.usuario_id = u.id
  LEFT JOIN estudiantes e ON e.usuario_id = u.id
  WHERE u.id = v_uid;
END$$

DELIMITER ;
