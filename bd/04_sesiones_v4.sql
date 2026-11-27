-- =====================================================================
-- EduControl · Etapa E · 04_sesiones_v4.sql  (sistema de sesiones v4)
-- NO PROBADO EN MARIADB 10.4.32. Ver bd/SEGURIDAD_v5_ANALISIS.md.
--
-- Principio: la identidad NUNCA llega como parámetro de usuario. Llega el TOKEN de sesión
-- (valor aleatorio en una cookie HttpOnly) y la base resuelve el usuario en cada llamada.
--
-- Decisiones de implementación (ver el análisis):
--  * fn_usuario_de_sesion NO usa FOR UPDATE. Un bloqueo dentro de una función en autocommit=1
--    se libera al terminar la sentencia y no protege nada. El procedimiento que escribe
--    vuelve a leer rol y estado con SELECT ... FOR UPDATE dentro de su propia transacción.
--  * Los procedimientos que escriben abren START TRANSACTION explícitamente; el handler hace
--    ROLLBACK y relanza el error. No hay DDL dentro de ningún procedimiento (causaría COMMIT implícito).
--  * Los errores se comunican con SIGNAL SQLSTATE '45000' y un texto "CODIGO|mensaje":
--    AUTH (sesión), PERM (rol), REGLA (regla de negocio), VAL (validación).
-- =====================================================================
SELECT DATABASE() AS base_activa;

CREATE TABLE sesiones_app (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira DATETIME NOT NULL,
  revocada TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_token (token_hash),
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sesiones_revocada CHECK (revocada IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

-- Usuario de un token vigente. NULL si no existe, está revocado, caducado o la cuenta no está ACTIVA.
-- Función de solo lectura: no escribe nada (sin UPDATE de ultimo_uso, a propósito).
CREATE DEFINER = 'educontrol_definer'@'localhost' FUNCTION fn_usuario_de_sesion(p_token VARCHAR(128)) RETURNS INT UNSIGNED
READS SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SELECT s.usuario_id INTO v_uid
  FROM sesiones_app s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token_hash = SHA2(p_token, 256)
    AND s.revocada = 0
    AND s.expira > NOW()
    AND u.estado = 'ACTIVO'
  LIMIT 1;
  RETURN v_uid;
END$$

-- Crea una sesión para un usuario que YA ha superado la verificación de contraseña en PHP.
-- Solo la cuenta educontrol_login puede ejecutarla (ver 06_permisos_v4.sql).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_sesion_crear(IN p_usuario_id INT UNSIGNED, IN p_token VARCHAR(128), IN p_horas INT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_rol VARCHAR(20);
  DECLARE v_estado VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  IF p_horas < 1 OR p_horas > 24 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VAL|Duración de sesión no válida';
  END IF;
  START TRANSACTION;
  SELECT rol, estado INTO v_rol, v_estado FROM usuarios WHERE id = p_usuario_id FOR UPDATE;
  IF v_rol IS NULL OR v_estado <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Cuenta no disponible';
  END IF;
  IF v_rol NOT IN ('ADMIN','PROFESOR','ALUMNO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Rol no admitido';
  END IF;
  INSERT INTO sesiones_app (token_hash, usuario_id, expira)
    VALUES (SHA2(p_token, 256), p_usuario_id, NOW() + INTERVAL p_horas HOUR);
  COMMIT;
END$$

-- Contexto de una sesión: quién es y qué rol tiene AHORA (se lee de usuarios en cada llamada).
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_sesion_contexto(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SET v_uid = fn_usuario_de_sesion(p_token);
  IF v_uid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Sesión no válida o caducada';
  END IF;
  SELECT id AS usuario_id, rol, nombre_usuario FROM usuarios WHERE id = v_uid;
END$$

-- Cierra la sesión del token indicado.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_sesion_revocar(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  UPDATE sesiones_app SET revocada = 1 WHERE token_hash = SHA2(p_token, 256);
END$$

-- Contexto común para los procedimientos de escritura: resuelve el usuario, BLOQUEA su fila de usuarios
-- (FOR UPDATE, dentro de la transacción del llamador), comprueba estado y rol. Uso interno.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_contexto_bloqueado(IN p_token VARCHAR(128), IN p_roles VARCHAR(60),
  OUT p_uid INT UNSIGNED, OUT p_rol VARCHAR(20))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_estado VARCHAR(10);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SET p_uid = fn_usuario_de_sesion(p_token);
  IF p_uid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Sesión no válida o caducada';
  END IF;
  SELECT rol, estado INTO p_rol, v_estado FROM usuarios WHERE id = p_uid FOR UPDATE;
  IF v_estado <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Cuenta inactiva';
  END IF;
  IF FIND_IN_SET(p_rol, p_roles) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PERM|Operación no permitida para su rol';
  END IF;
END$$

-- Contexto de lectura (sin bloqueo): para procedimientos de solo lectura.
CREATE DEFINER = 'educontrol_definer'@'localhost' PROCEDURE sp_interno_contexto_lectura(IN p_token VARCHAR(128), IN p_roles VARCHAR(60),
  OUT p_uid INT UNSIGNED, OUT p_rol VARCHAR(20))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_estado VARCHAR(10);
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SET p_uid = fn_usuario_de_sesion(p_token);
  IF p_uid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Sesión no válida o caducada';
  END IF;
  SELECT rol, estado INTO p_rol, v_estado FROM usuarios WHERE id = p_uid;
  IF v_estado <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUTH|Cuenta inactiva';
  END IF;
  IF FIND_IN_SET(p_rol, p_roles) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PERM|Operación no permitida para su rol';
  END IF;
END$$

DELIMITER ;
