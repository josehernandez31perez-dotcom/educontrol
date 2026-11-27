-- =====================================================================
-- EduControl · Etapa E · 01_nueva_estructura.sql  (v4)
-- Crea las tablas NUEVAS. No modifica tablas existentes (eso es 02_migracion.sql).
-- NO PROBADO EN MARIADB 10.4.32. Ver bd/ESTADO_Y_LIMITES_v4.md.
-- Sin IF NOT EXISTS: falla si una tabla ya existe, para no sobrescribir nada.
-- ATENCIÓN: este script no selecciona base. Seleccionar la base ANTES de ejecutar.
-- =====================================================================
SELECT DATABASE() AS base_activa;  -- comprobar que es la base de PRUEBA

-- ---------- Períodos académicos ----------
CREATE TABLE periodos_academicos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio_escolar SMALLINT UNSIGNED NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado ENUM('ABIERTO','CERRADO') NOT NULL DEFAULT 'ABIERTO',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_periodos_anio_nombre (anio_escolar, nombre),
  CONSTRAINT chk_periodos_anio CHECK (anio_escolar BETWEEN 2000 AND 2100),
  CONSTRAINT chk_periodos_nombre CHECK (TRIM(nombre) <> ''),
  CONSTRAINT chk_periodos_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT chk_periodos_cierre CHECK (
    (estado = 'ABIERTO' AND fecha_cierre IS NULL) OR (estado = 'CERRADO' AND fecha_cierre IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Profesores (perfil; cada uno tiene UNA cuenta) ----------
CREATE TABLE profesores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  correo VARCHAR(120) NULL DEFAULT NULL,
  estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profesores_usuario (usuario_id),
  UNIQUE KEY uq_profesores_cedula (cedula),
  CONSTRAINT fk_profesores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_profesores_cedula CHECK (TRIM(cedula) <> ''),
  CONSTRAINT chk_profesores_nombre CHECK (TRIM(nombre) <> ''),
  CONSTRAINT chk_profesores_apellido CHECK (TRIM(apellido) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Secciones (grupo de una materia en un período) ----------
CREATE TABLE secciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  materia_id INT UNSIGNED NOT NULL,
  periodo_id INT UNSIGNED NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  estado ENUM('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_secciones_materia_periodo_codigo (materia_id, periodo_id, codigo),
  UNIQUE KEY uq_secciones_id_materia_periodo (id, materia_id, periodo_id),
  KEY idx_secciones_periodo (periodo_id),
  CONSTRAINT fk_secciones_materia FOREIGN KEY (materia_id) REFERENCES materias (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_secciones_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_academicos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_secciones_codigo CHECK (TRIM(codigo) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Asignación profesor-sección, con historial ----------
CREATE TABLE profesor_seccion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  profesor_id INT UNSIGNED NOT NULL,
  seccion_id INT UNSIGNED NOT NULL,
  estado ENUM('ACTIVA','FINALIZADA') NOT NULL DEFAULT 'ACTIVA',
  fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATETIME NULL DEFAULT NULL,
  clave_activa_profesor INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN estado = 'ACTIVA' THEN profesor_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profesor_seccion_activa (clave_activa_profesor, seccion_id),
  KEY idx_profesor_seccion_profesor (profesor_id),
  KEY idx_profesor_seccion_seccion (seccion_id),
  CONSTRAINT fk_profesor_seccion_profesor FOREIGN KEY (profesor_id) REFERENCES profesores (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_profesor_seccion_seccion FOREIGN KEY (seccion_id) REFERENCES secciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_profesor_seccion_fin CHECK (
    (estado = 'ACTIVA' AND fecha_fin IS NULL) OR (estado = 'FINALIZADA' AND fecha_fin IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Inscripción estudiante-sección, con historial ----------
-- materia_id y periodo_id se copian de la sección; la clave compuesta impide que no coincidan.
-- Unicidad: un alumno tiene como mucho UNA inscripción ACTIVA por materia y período (decisión 3).
CREATE TABLE estudiante_seccion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estudiante_id INT UNSIGNED NOT NULL,
  seccion_id INT UNSIGNED NOT NULL,
  materia_id INT UNSIGNED NOT NULL,
  periodo_id INT UNSIGNED NOT NULL,
  estado ENUM('ACTIVA','RETIRADA','FINALIZADA') NOT NULL DEFAULT 'ACTIVA',
  fecha_inscripcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATETIME NULL DEFAULT NULL,
  clave_activa_estudiante INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN estado = 'ACTIVA' THEN estudiante_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_es_activa_materia_periodo (clave_activa_estudiante, materia_id, periodo_id),
  KEY idx_es_estudiante (estudiante_id),
  KEY idx_es_seccion_materia_periodo (seccion_id, materia_id, periodo_id),
  CONSTRAINT fk_es_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_es_seccion_coherente FOREIGN KEY (seccion_id, materia_id, periodo_id)
    REFERENCES secciones (id, materia_id, periodo_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_es_fin CHECK (
    (estado = 'ACTIVA' AND fecha_fin IS NULL) OR (estado <> 'ACTIVA' AND fecha_fin IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Evaluaciones de una sección ----------
CREATE TABLE evaluaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seccion_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  peso DECIMAL(5,2) NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluaciones_seccion_nombre (seccion_id, nombre),
  CONSTRAINT fk_evaluaciones_seccion FOREIGN KEY (seccion_id) REFERENCES secciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_evaluaciones_peso CHECK (peso > 0 AND peso <= 100),
  CONSTRAINT chk_evaluaciones_nombre CHECK (TRIM(nombre) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Notas individuales por evaluación ----------
CREATE TABLE notas_evaluacion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  evaluacion_id INT UNSIGNED NOT NULL,
  estudiante_id INT UNSIGNED NOT NULL,
  nota DECIMAL(2,1) NOT NULL,
  registrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notas_eval_alumno (evaluacion_id, estudiante_id),
  KEY idx_notas_estudiante (estudiante_id),
  CONSTRAINT fk_notas_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notas_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_notas_eval_rango CHECK (nota BETWEEN 1.0 AND 5.0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- NO APLICA por alumno y evaluación (historial completo) ----------
CREATE TABLE evaluacion_no_aplica (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evaluacion_id INT UNSIGNED NOT NULL,
  estudiante_id INT UNSIGNED NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  marcado_por INT UNSIGNED NOT NULL,
  fecha_marca DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('VIGENTE','REVOCADA') NOT NULL DEFAULT 'VIGENTE',
  revocado_por INT UNSIGNED NULL DEFAULT NULL,
  fecha_revocacion DATETIME NULL DEFAULT NULL,
  motivo_revocacion VARCHAR(500) NULL DEFAULT NULL,
  clave_vigente INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN estado = 'VIGENTE' THEN estudiante_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_no_aplica_vigente (evaluacion_id, clave_vigente),
  KEY idx_no_aplica_estudiante (estudiante_id),
  CONSTRAINT fk_no_aplica_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_no_aplica_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_no_aplica_marcado FOREIGN KEY (marcado_por) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_no_aplica_revocado FOREIGN KEY (revocado_por) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_no_aplica_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) >= 10),
  CONSTRAINT chk_no_aplica_revocacion CHECK (
    (estado = 'VIGENTE' AND revocado_por IS NULL AND fecha_revocacion IS NULL AND motivo_revocacion IS NULL) OR
    (estado = 'REVOCADA' AND revocado_por IS NOT NULL AND fecha_revocacion IS NOT NULL
       AND CHAR_LENGTH(TRIM(motivo_revocacion)) >= 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Pendientes de calificación (resolución administrativa) ----------
CREATE TABLE pendientes_calificacion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  periodo_id INT UNSIGNED NOT NULL,
  seccion_id INT UNSIGNED NOT NULL,
  estudiante_id INT UNSIGNED NOT NULL,
  tipo ENUM('SIN_NOTA','TODAS_NO_APLICA') NOT NULL,
  fecha_detectado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('ABIERTO','RESUELTO') NOT NULL DEFAULT 'ABIERTO',
  resolucion ENUM('REVOCAR_NO_APLICA','REGISTRAR_NOTA','EXCLUIR_ALUMNO') NULL DEFAULT NULL,
  resuelto_por INT UNSIGNED NULL DEFAULT NULL,
  fecha_resolucion DATETIME NULL DEFAULT NULL,
  motivo_resolucion VARCHAR(500) NULL DEFAULT NULL,
  clave_abierta INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN estado = 'ABIERTO' THEN 1 ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pendiente_abierto (seccion_id, estudiante_id, clave_abierta),
  KEY idx_pendiente_periodo (periodo_id),
  CONSTRAINT fk_pend_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_academicos (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pend_seccion FOREIGN KEY (seccion_id) REFERENCES secciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pend_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pend_resuelto FOREIGN KEY (resuelto_por) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Observaciones sobre un alumno (solo profesor de la sección y ADMIN) ----------
CREATE TABLE observaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estudiante_id INT UNSIGNED NOT NULL,
  seccion_id INT UNSIGNED NOT NULL,
  autor_usuario_id INT UNSIGNED NOT NULL,
  texto VARCHAR(1000) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_obs_seccion (seccion_id),
  KEY idx_obs_estudiante (estudiante_id),
  CONSTRAINT fk_obs_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_obs_seccion FOREIGN KEY (seccion_id) REFERENCES secciones (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_obs_autor FOREIGN KEY (autor_usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_obs_texto CHECK (CHAR_LENGTH(TRIM(texto)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Auditoría (solo inserción; la escriben los procedimientos) ----------
CREATE TABLE auditoria_academica (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT UNSIGNED NOT NULL,
  accion ENUM('CREAR_CUENTA','CREAR_PERSONA','ASIGNAR_ROL','VINCULAR_CUENTA','CAMBIAR_ESTADO_USUARIO',
    'CAMBIAR_ESTADO_PERSONA','CAMBIAR_ESTADO_SECCION','RESTABLECER_PASSWORD','CREAR_PERIODO','CERRAR_PERIODO',
    'REABRIR_PERIODO','FINALIZAR_RELACION','CLASIFICAR_CALIFICACION','MARCAR_NO_APLICA','REVOCAR_NO_APLICA',
    'RESOLVER_PENDIENTE','CORREGIR_EVALUACION','CORREGIR_CALIFICACION','CREAR_SECCION','ASIGNAR_PROFESOR',
    'INSCRIBIR_ESTUDIANTE','CREAR_EVALUACION','REGISTRAR_OBSERVACION') NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  entidad_id BIGINT UNSIGNED NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  detalle TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_aud_entidad (entidad, entidad_id),
  KEY idx_aud_fecha (fecha),
  CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_aud_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) >= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
