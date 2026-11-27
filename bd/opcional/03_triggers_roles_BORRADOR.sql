-- =====================================================================
-- EduControl · OPCIONAL · 03_triggers_roles_BORRADOR.sql
-- ESTADO: BORRADOR. NO VERIFICADO EN MARIADB 10.4.32. NO incluido en el orden de
-- instalación de bd/README.md. Solo se considerará tras probarlo en educontrol_pruebas.
--
-- PROPÓSITO: defensa en profundidad. Impide, a nivel de base de datos, que un
-- profesor quede vinculado a un usuario que no sea PROFESOR, que un alumno quede
-- vinculado a un usuario que no sea ALUMNO, o que se cambie el rol de un usuario
-- que sigue vinculado. La validación PRINCIPAL debe estar en el backend (ver
-- bd/REGLAS_BACKEND.md); el trigger es una segunda barrera.
--
-- LIMITACIONES CONOCIDAS (a verificar):
--  * MySQL no activa triggers por acciones en cascada de claves foráneas
--    (ON UPDATE CASCADE / ON DELETE SET NULL). Comprobar el comportamiento en MariaDB.
--  * MariaDB no admite triggers por columna: estos disparan en cualquier UPDATE.
--  * Requiere DELIMITER: phpMyAdmin debe procesarlo; si no, ejecutar desde consola.
--  * Un UPDATE que no cambia nada igualmente dispara la comprobación (es correcto).
-- =====================================================================

DELIMITER $$

-- Profesor: el usuario debe existir y tener rol PROFESOR.
CREATE TRIGGER trg_profesores_rol_bi BEFORE INSERT ON profesores FOR EACH ROW
BEGIN
  DECLARE v_rol VARCHAR(20);
  SELECT rol INTO v_rol FROM usuarios WHERE id = NEW.usuario_id;
  IF v_rol IS NULL OR v_rol <> 'PROFESOR' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El usuario vinculado a un profesor debe tener rol PROFESOR';
  END IF;
END$$

CREATE TRIGGER trg_profesores_rol_bu BEFORE UPDATE ON profesores FOR EACH ROW
BEGIN
  DECLARE v_rol VARCHAR(20);
  SELECT rol INTO v_rol FROM usuarios WHERE id = NEW.usuario_id;
  IF v_rol IS NULL OR v_rol <> 'PROFESOR' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El usuario vinculado a un profesor debe tener rol PROFESOR';
  END IF;
END$$

-- Alumno: si hay vínculo, el usuario debe tener rol ALUMNO. NULL está permitido.
CREATE TRIGGER trg_estudiantes_rol_bi BEFORE INSERT ON estudiantes FOR EACH ROW
BEGIN
  DECLARE v_rol VARCHAR(20);
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT rol INTO v_rol FROM usuarios WHERE id = NEW.usuario_id;
    IF v_rol IS NULL OR v_rol <> 'ALUMNO' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El usuario vinculado a un alumno debe tener rol ALUMNO';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_estudiantes_rol_bu BEFORE UPDATE ON estudiantes FOR EACH ROW
BEGIN
  DECLARE v_rol VARCHAR(20);
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT rol INTO v_rol FROM usuarios WHERE id = NEW.usuario_id;
    IF v_rol IS NULL OR v_rol <> 'ALUMNO' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El usuario vinculado a un alumno debe tener rol ALUMNO';
    END IF;
  END IF;
END$$

-- Usuario: no se puede cambiar el rol de una cuenta que sigue vinculada.
CREATE TRIGGER trg_usuarios_rol_bu BEFORE UPDATE ON usuarios FOR EACH ROW
BEGIN
  IF NEW.rol <> OLD.rol THEN
    IF OLD.rol = 'PROFESOR' AND EXISTS (SELECT 1 FROM profesores WHERE usuario_id = OLD.id) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol de un usuario vinculado a un profesor';
    END IF;
    IF OLD.rol = 'ALUMNO' AND EXISTS (SELECT 1 FROM estudiantes WHERE usuario_id = OLD.id) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol de un usuario vinculado a un alumno';
    END IF;
  END IF;
END$$

DELIMITER ;
