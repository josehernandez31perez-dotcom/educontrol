-- EduControl: base de datos única (MySQL/MariaDB)
-- Ejecutar en phpMyAdmin o MySQL Workbench.
CREATE DATABASE IF NOT EXISTS educontrol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE educontrol;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN','CONSULTA') NOT NULL DEFAULT 'CONSULTA',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiantes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cedula VARCHAR(25) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  estado ENUM('ACTIVO','INACTIVO','RETIRADO','GRADUADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_estudiante_nombre (apellido,nombre),
  INDEX idx_estudiante_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  estado ENUM('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calificaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT UNSIGNED NOT NULL,
  materia_id INT UNSIGNED NOT NULL,
  nota DECIMAL(4,2) NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_calificacion_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_calificacion_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uq_calificacion_estudiante_materia UNIQUE (estudiante_id,materia_id),
  CONSTRAINT chk_nota_rango CHECK (nota >= 0 AND nota <= 10),
  INDEX idx_calificaciones_materia (materia_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion_academica (
  id TINYINT UNSIGNED PRIMARY KEY,
  nota_minima DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  nota_maxima DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  nota_aprobacion DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_config_nota CHECK (nota_minima < nota_maxima AND nota_aprobacion >= nota_minima AND nota_aprobacion <= nota_maxima)
) ENGINE=InnoDB;
INSERT INTO configuracion_academica (id,nota_minima,nota_maxima,nota_aprobacion)
VALUES (1,1.0,5.0,3.0) ON DUPLICATE KEY UPDATE id=id;

-- Materias iniciales para que el sistema arranque con el catálogo básico.
INSERT IGNORE INTO materias (nombre) VALUES
('Matemáticas'),('Español'),('Ciencias Naturales'),('Ciencias Sociales'),('Inglés');

-- Usuarios demo: admin/admin123 y consulta/consulta123
INSERT INTO usuarios (nombre_usuario,password_hash,rol,activo) VALUES
('admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9','ADMIN',1),
('consulta','7fa95c704c2defa7b1295d28bcddfd752bf9b594db18886dd64721183cfc47a5','CONSULTA',1)
ON DUPLICATE KEY UPDATE rol=VALUES(rol),activo=VALUES(activo);
