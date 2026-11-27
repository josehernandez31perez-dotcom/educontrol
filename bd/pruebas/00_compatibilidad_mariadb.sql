-- =====================================================================
-- EduControl · PRUEBAS · 00_compatibilidad_mariadb.sql
-- Verifica EN EL MOTOR (MariaDB 10.4.32) cada característica que usa la estructura.
-- No basta con leer el DDL: esto debe ejecutarse y comparar cada resultado.
--
-- SEGURIDAD:
--  * Usa SOLO la base "educontrol_pruebas_compat" (se crea aquí; falla si ya existe).
--  * Crea y borra únicamente tablas con prefijo zz_ dentro de esa base.
--  * No contiene DROP DATABASE. Eliminar la base a mano al terminar, si se desea.
--  * Ejecutar con --force (consola) para que los errores esperados no detengan la prueba.
--    En phpMyAdmin, ejecutar y revisar cada error contra el resultado esperado.
-- =====================================================================

CREATE DATABASE educontrol_pruebas_compat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE educontrol_pruebas_compat;
SELECT DATABASE() AS base_activa, VERSION() AS version_servidor, @@sql_mode AS sql_mode;
-- ESPERADO: version_servidor 10.4.32-MariaDB (o 10.4.x); sql_mode incluye STRICT_TRANS_TABLES

-- ---------- G1. CHECK se aplica ----------
CREATE TABLE zz_g1 (a INT UNSIGNED NOT NULL, CONSTRAINT chk_g1 CHECK (a BETWEEN 1 AND 5)) ENGINE=InnoDB;
INSERT INTO zz_g1 VALUES (9);
-- ESPERADO: ERROR 4025 (CONSTRAINT chk_g1 failed)

-- ---------- G2. Columna VIRTUAL con CASE + índice UNIQUE sobre ella ----------
CREATE TABLE zz_g2 (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estudiante_id INT UNSIGNED NOT NULL,
  seccion_id INT UNSIGNED NOT NULL,
  estado ENUM('ACTIVA','RETIRADA') NOT NULL DEFAULT 'ACTIVA',
  clave INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN estado = 'ACTIVA' THEN estudiante_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_g2 (clave, seccion_id)
) ENGINE=InnoDB;
INSERT INTO zz_g2 (estudiante_id, seccion_id) VALUES (1, 1);                 -- ESPERADO: OK
INSERT INTO zz_g2 (estudiante_id, seccion_id, estado) VALUES (1, 1, 'RETIRADA'); -- ESPERADO: OK (historial)
INSERT INTO zz_g2 (estudiante_id, seccion_id) VALUES (1, 1);                 -- ESPERADO: ERROR 1062 (Duplicate entry ... uq_g2)
SELECT id, estudiante_id, estado, clave FROM zz_g2 ORDER BY id;
-- ESPERADO: fila 1 con clave=1; fila 2 (RETIRADA) con clave NULL

-- ---------- G3. ENUM estricto rechaza valores no admitidos ----------
INSERT INTO zz_g2 (estudiante_id, seccion_id, estado) VALUES (2, 2, 'OTRO');
-- ESPERADO: ERROR 1265 (Data truncated for column 'estado')

-- ---------- G4. FK RESTRICT en ambos sentidos ----------
CREATE TABLE zz_g4_padre (id INT UNSIGNED NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB;
CREATE TABLE zz_g4_hijo (
  id INT UNSIGNED NOT NULL, padre INT UNSIGNED NOT NULL, PRIMARY KEY (id),
  CONSTRAINT fk_g4 FOREIGN KEY (padre) REFERENCES zz_g4_padre (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
INSERT INTO zz_g4_padre VALUES (1);
INSERT INTO zz_g4_hijo VALUES (1, 1);
DELETE FROM zz_g4_padre WHERE id = 1;     -- ESPERADO: ERROR 1451
INSERT INTO zz_g4_hijo VALUES (2, 99);    -- ESPERADO: ERROR 1452

-- ---------- G5. DEFAULT CURRENT_TIMESTAMP en DATETIME ----------
CREATE TABLE zz_g5 (id INT UNSIGNED NOT NULL, f DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB;
INSERT INTO zz_g5 (id) VALUES (1);
SELECT f IS NOT NULL AS valor_por_defecto FROM zz_g5;   -- ESPERADO: 1

-- ---------- G6. MODIFY de ENUM ampliando valores con filas existentes (como 02_migracion) ----------
ALTER TABLE zz_g2 MODIFY estado ENUM('ACTIVA','RETIRADA','FINALIZADA') NOT NULL DEFAULT 'ACTIVA';
-- ESPERADO: OK, sin error. Las filas existentes conservan su valor.
SELECT COUNT(*) AS filas_conservadas FROM zz_g2;        -- ESPERADO: 2

-- ---------- G7. UNIQUE sobre columna NULL: varios NULL permitidos ----------
CREATE TABLE zz_g7 (id INT UNSIGNED NOT NULL, x INT UNSIGNED NULL, PRIMARY KEY (id)) ENGINE=InnoDB;
ALTER TABLE zz_g7 ADD CONSTRAINT uq_g7 UNIQUE (x);
INSERT INTO zz_g7 VALUES (1, NULL), (2, NULL);          -- ESPERADO: OK (NULL no se repite en UNIQUE)
INSERT INTO zz_g7 VALUES (3, 5), (4, 5);                -- ESPERADO: ERROR 1062 (uq_g7)

-- ---------- G8. Restricciones con nombre (ADD CONSTRAINT CHECK) ----------
ALTER TABLE zz_g7 ADD CONSTRAINT chk_g7 CHECK (x IS NULL OR x > 0);
INSERT INTO zz_g7 VALUES (5, 0);                        -- ESPERADO: ERROR 4025 (chk_g7)

-- ---------- Limpieza: solo tablas zz_ creadas por esta prueba ----------
DROP TABLE IF EXISTS zz_g4_hijo;
DROP TABLE IF EXISTS zz_g4_padre;
DROP TABLE IF EXISTS zz_g5;
DROP TABLE IF EXISTS zz_g7;
DROP TABLE IF EXISTS zz_g2;
DROP TABLE IF EXISTS zz_g1;
-- La base educontrol_pruebas_compat puede eliminarse a mano si ya no se necesita.
