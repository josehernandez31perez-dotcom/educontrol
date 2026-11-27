-- =====================================================================
-- EduControl · PRUEBAS · 01_base_minima_prueba.sql
-- Crea la base de PRUEBA "educontrol_pruebas" con una réplica mínima del esquema
-- actual (documento de continuidad, sección 6) y datos de demostración.
--
-- SEGURIDAD:
--  * NO borra ninguna base de datos. No contiene DROP DATABASE.
--  * CREATE DATABASE SIN "IF NOT EXISTS": si educontrol_pruebas ya existe, la
--    sentencia FALLA (ERROR 1007) y el script se detiene. Nunca sobrescribe nada.
--  * No usar --force con este script: si la base existe, el error debe detener todo.
--  * Para repetir las pruebas, eliminar "educontrol_pruebas" A MANO (phpMyAdmin o
--    consola), tras comprobar su nombre exacto y que no contiene datos que interesen.
--  * La cuenta admin es FICTICIA (hash no real): no sirve para iniciar sesión.
--  * Nunca ejecutar contra la base real "educontrol".
-- =====================================================================

CREATE DATABASE educontrol_pruebas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE educontrol_pruebas;
SELECT DATABASE() AS base_activa;  -- debe mostrar: educontrol_pruebas

CREATE TABLE usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_usuario VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN','CONSULTA') NOT NULL DEFAULT 'CONSULTA',
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_nombre (nombre_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE estudiantes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cedula VARCHAR(20) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  estado ENUM('ACTIVO','INACTIVO','RETIRADO','GRADUADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estudiantes_cedula (cedula),
  CONSTRAINT chk_estudiantes_cedula CHECK (TRIM(cedula) <> ''),
  CONSTRAINT chk_estudiantes_nombre CHECK (TRIM(nombre) <> ''),
  CONSTRAINT chk_estudiantes_apellido CHECK (TRIM(apellido) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  estado ENUM('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  PRIMARY KEY (id),
  UNIQUE KEY uq_materias_nombre (nombre),
  CONSTRAINT chk_materias_nombre CHECK (TRIM(nombre) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calificaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estudiante_id INT UNSIGNED NOT NULL,
  materia_id INT UNSIGNED NOT NULL,
  nota DECIMAL(2,1) NOT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_calificaciones_estudiante_materia (estudiante_id, materia_id),
  CONSTRAINT chk_calificaciones_nota CHECK (nota BETWEEN 1.0 AND 5.0),
  CONSTRAINT fk_calificaciones_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_calificaciones_materia FOREIGN KEY (materia_id) REFERENCES materias (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos de demostración (mismos que la siembra de la aplicación)
INSERT INTO usuarios (id, nombre_usuario, password, rol) VALUES
  (1, 'admin', 'HASH_FICTICIO_NO_REAL', 'ADMIN'),
  (2, 'consulta', 'HASH_FICTICIO_NO_REAL', 'CONSULTA');

INSERT INTO estudiantes (id, cedula, nombre, apellido, estado, fecha_registro) VALUES
  (1, '8-100-100', 'Ana', 'Pérez', 'ACTIVO', '2026-10-01 09:00:00'),
  (3, '8-300-300', 'Lucía', 'Martínez', 'ACTIVO', '2026-10-01 09:05:00'),
  (4, '8-400-400', 'Miguel', 'Rojas', 'ACTIVO', '2026-10-01 09:10:00');

INSERT INTO materias (id, nombre, estado) VALUES
  (1, 'Matemáticas', 'ACTIVA'), (2, 'Español', 'ACTIVA'), (3, 'Ciencias Naturales', 'ACTIVA'),
  (4, 'Ciencias Sociales', 'ACTIVA'), (5, 'Inglés', 'ACTIVA');

INSERT INTO calificaciones (id, estudiante_id, materia_id, nota, fecha_registro) VALUES
  (1, 1, 1, 4.5, '2026-10-01 10:00:00'), (2, 1, 2, 4.0, '2026-10-01 10:00:00'),
  (3, 1, 3, 3.8, '2026-10-01 10:00:00'), (4, 1, 4, 4.2, '2026-10-01 10:00:00'),
  (5, 1, 5, 4.6, '2026-10-01 10:00:00'), (6, 3, 1, 3.0, '2026-10-01 10:05:00'),
  (7, 3, 2, 3.0, '2026-10-01 10:05:00'), (8, 3, 3, 3.0, '2026-10-01 10:05:00'),
  (9, 3, 4, 3.0, '2026-10-01 10:05:00'), (10, 3, 5, 3.0, '2026-10-01 10:05:00');
