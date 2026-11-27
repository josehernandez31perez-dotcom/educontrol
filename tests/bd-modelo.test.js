/* Etapa E · Parte 1: pruebas de la LÓGICA de la estructura académica en un MODELO SQLite (node:sqlite).
   IMPORTANTE: SQLite no es MariaDB. Esto comprueba las reglas (duplicados, fechas, huérfanos, conservación)
   con equivalentes SQLite del DDL de bd/. NO sustituye a bd/pruebas/02_pruebas_mariadb.sql, que debe
   ejecutarse en MariaDB 10.4.32 sobre educontrol_test. Las diferencias se documentan en el informe. */
const { probador } = require('./helpers');
const t = probador();

// Silencia el aviso de "experimental" de node:sqlite para que la salida de las pruebas sea limpia
const emitir = process.emitWarning;
process.emitWarning = () => {};
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = emitir;

// Estado existente (equivalente a la base real según el documento de continuidad, sección 6)
const BASE = `
  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'CONSULTA' CHECK (rol IN ('ADMIN','CONSULTA'))
  );
  CREATE TABLE estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','RETIRADO','GRADUADO')),
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE materias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    estado TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','INACTIVA'))
  );
  CREATE TABLE calificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    nota REAL NOT NULL CHECK (nota BETWEEN 1.0 AND 5.0),
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (estudiante_id, materia_id)
  );
`;

// Nueva estructura (equivalente SQLite de bd/01_nueva_estructura.sql)
const NUEVA = `
  CREATE TABLE periodos_academicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anio_escolar INTEGER NOT NULL CHECK (anio_escolar BETWEEN 2000 AND 2100),
    nombre TEXT NOT NULL CHECK (trim(nombre) <> ''),
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO','CERRADO')),
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TEXT NULL DEFAULT NULL,
    CONSTRAINT uq_periodos_anio_nombre UNIQUE (anio_escolar, nombre),
    CONSTRAINT chk_periodos_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_periodos_cierre CHECK (
      (estado = 'ABIERTO' AND fecha_cierre IS NULL) OR
      (estado = 'CERRADO' AND fecha_cierre IS NOT NULL))
  );
  CREATE TABLE profesores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    cedula TEXT NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    correo TEXT NULL DEFAULT NULL,
    estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profesores_usuario UNIQUE (usuario_id),
    CONSTRAINT uq_profesores_cedula UNIQUE (cedula),
    CONSTRAINT fk_profesores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE TABLE secciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    materia_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    codigo TEXT NOT NULL COLLATE NOCASE,
    estado TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','INACTIVA')),
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_secciones_materia_periodo_codigo UNIQUE (materia_id, periodo_id, codigo),
    CONSTRAINT fk_secciones_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_secciones_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_academicos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_secciones_codigo CHECK (trim(codigo) <> '')
  );
  CREATE TABLE profesor_seccion (
    profesor_id INTEGER NOT NULL,
    seccion_id INTEGER NOT NULL,
    fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profesor_id, seccion_id),
    CONSTRAINT fk_profesor_seccion_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_profesor_seccion_seccion FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE TABLE estudiante_seccion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_id INTEGER NOT NULL,
    seccion_id INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','RETIRADA','FINALIZADA')),
    fecha_inscripcion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TEXT NULL DEFAULT NULL,
    inscripcion_activa_estudiante INTEGER GENERATED ALWAYS AS
      (CASE WHEN estado = 'ACTIVA' THEN estudiante_id ELSE NULL END) VIRTUAL,
    CONSTRAINT uq_estudiante_seccion_activa UNIQUE (inscripcion_activa_estudiante, seccion_id),
    CONSTRAINT fk_estudiante_seccion_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_estudiante_seccion_seccion FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_estudiante_seccion_fin CHECK (
      (estado = 'ACTIVA' AND fecha_fin IS NULL) OR
      (estado <> 'ACTIVA' AND fecha_fin IS NOT NULL))
  );
`;

// Migración (equivalente SQLite de bd/02_migracion.sql). En SQLite el ENUM de usuarios.rol no se
// modifica en sitio: se reconstruye la tabla copiando las filas. MariaDB usa MODIFY.
const MIGRACION = `
  CREATE TABLE usuarios_nueva (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'CONSULTA' CHECK (rol IN ('ADMIN','CONSULTA','PROFESOR','ALUMNO'))
  );
  INSERT INTO usuarios_nueva (id, nombre_usuario, password, rol) SELECT id, nombre_usuario, password, rol FROM usuarios;
  DROP TABLE usuarios;
  ALTER TABLE usuarios_nueva RENAME TO usuarios;
  ALTER TABLE estudiantes ADD COLUMN usuario_id INTEGER NULL DEFAULT NULL REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;
  CREATE UNIQUE INDEX uq_estudiantes_usuario ON estudiantes(usuario_id);
`;

const SEMILLA = `
  INSERT INTO usuarios (id, nombre_usuario, password, rol) VALUES (1,'admin','HASH_FICTICIO','ADMIN'),(2,'consulta','HASH_FICTICIO','CONSULTA');
  INSERT INTO estudiantes (id, cedula, nombre, apellido, estado, fecha_registro) VALUES
    (1,'8-100-100','Ana','Pérez','ACTIVO','2026-10-01 09:00:00'),(3,'8-300-300','Lucía','Martínez','ACTIVO','2026-10-01 09:05:00'),(4,'8-400-400','Miguel','Rojas','ACTIVO','2026-10-01 09:10:00');
  INSERT INTO materias (id, nombre, estado) VALUES (1,'Matemáticas','ACTIVA'),(2,'Español','ACTIVA'),(3,'Ciencias Naturales','ACTIVA'),(4,'Ciencias Sociales','ACTIVA'),(5,'Inglés','ACTIVA');
  INSERT INTO calificaciones (id, estudiante_id, materia_id, nota) VALUES
    (1,1,1,4.5),(2,1,2,4.0),(3,1,3,3.8),(4,1,4,4.2),(5,1,5,4.6),(6,3,1,3.0),(7,3,2,3.0),(8,3,3,3.0),(9,3,4,3.0),(10,3,5,3.0);
`;

const PREPARACION = `
  INSERT INTO periodos_academicos (id, anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES
    (1,2026,'Primer trimestre','2026-02-01','2026-04-30'),(2,2026,'Segundo trimestre','2026-05-01','2026-07-31');
  INSERT INTO secciones (id, materia_id, periodo_id, codigo) VALUES (1,1,1,'A'),(2,1,1,'B'),(3,2,1,'A'),(4,1,2,'A');
  INSERT INTO usuarios (id, nombre_usuario, password, rol) VALUES (3,'carlos.ruiz','HASH_FICTICIO','PROFESOR'),(4,'maria.lopez','HASH_FICTICIO','PROFESOR'),(5,'ana.perez','HASH_FICTICIO','ALUMNO');
  INSERT INTO profesores (id, usuario_id, cedula, nombre, apellido) VALUES (1,3,'9-100-100','Carlos','Ruiz'),(2,4,'9-200-200','María','López');
`;

function nuevaBase({ conPreparacion = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(BASE);
  db.exec(SEMILLA);
  const antes = instantanea(db);
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(MIGRACION);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(NUEVA);
  if (conPreparacion) { db.exec(PREPARACION); }
  db.antesMigracion = antes;
  return db;
}

function instantanea(db) {
  const filas = q => db.prepare(q).all();
  return {
    estudiantes: filas('SELECT id, cedula, nombre, apellido, estado FROM estudiantes ORDER BY id'),
    materias: filas('SELECT id, nombre, estado FROM materias ORDER BY id'),
    calificaciones: filas('SELECT id, estudiante_id, materia_id, nota FROM calificaciones ORDER BY id'),
    admin: filas("SELECT id, nombre_usuario, rol FROM usuarios WHERE nombre_usuario = 'admin'")
  };
}

// Ejecuta una sentencia y devuelve el mensaje de error, o null si funciona
function error(db, sql) {
  try { db.exec(sql); return null; } catch (e) { return e.message; }
}

(() => {
  console.log('== Un profesor puede pertenecer a varias secciones y una sección a varios profesores ==');
  let db = nuevaBase({ conPreparacion: true });
  t.afirmar('01 profesor 1 en secciones 1 y 3', error(db, 'INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1,1),(1,3)') === null);
  t.afirmar('02 sección 1 con profesores 1 y 2', error(db, 'INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (2,1)') === null);

  console.log('== Un alumno en varias secciones y una sección con varios alumnos ==');
  t.afirmar('03 estudiante 1 en secciones 1 y 3', error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (1,1),(1,3)") === null);
  t.afirmar('04 sección 1 con estudiante 3', error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (3,1)") === null);

  console.log('== Inscripciones: sin duplicados activos, con historial ==');
  t.afirmar('05 inscripción activa duplicada se rechaza', /UNIQUE/.test(error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (1,1)") || ''));
  t.afirmar('06 retirada previa de estudiante 4 se admite', error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id, estado, fecha_fin) VALUES (4,1,'RETIRADA','2026-03-15')") === null);
  t.afirmar('07 nueva activa tras la retirada se admite', error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (4,1)") === null);
  t.afirmar('08 segunda activa del mismo estudiante en la misma sección se rechaza', /UNIQUE/.test(error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (4,1)") || ''));
  t.afirmar('09 activa con fecha de fin se rechaza', /CHECK/.test(error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id, estado, fecha_fin) VALUES (3,2,'ACTIVA','2026-06-01')") || ''));
  t.afirmar('10 retirada sin fecha de fin se rechaza', /CHECK/.test(error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id, estado) VALUES (3,2,'RETIRADA')") || ''));
  db.close();

  console.log('== Asignaciones de profesores ==');
  db = nuevaBase({ conPreparacion: true });
  db.exec('INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1,1)');
  t.afirmar('11 asignación profesor-sección duplicada se rechaza', /UNIQUE|PRIMARY KEY/.test(error(db, 'INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1,1)') || ''));

  console.log('== Períodos académicos ==');
  t.afirmar('12 período con fecha de fin anterior al inicio se rechaza', /CHECK/.test(error(db, "INSERT INTO periodos_academicos (anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES (2026,'Fechas invertidas','2026-05-01','2026-04-01')") || ''));
  t.afirmar('13 período con inicio = fin se admite', error(db, "INSERT INTO periodos_academicos (anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES (2026,'Tercer trimestre','2026-08-01','2026-08-01')") === null);
  t.afirmar('14 cierre manual de un período se admite', error(db, "UPDATE periodos_academicos SET estado='CERRADO', fecha_cierre='2026-11-26 10:00:00' WHERE id=1") === null);
  t.afirmar('15 CERRADO sin fecha de cierre se rechaza', /CHECK/.test(error(db, "UPDATE periodos_academicos SET estado='CERRADO', fecha_cierre=NULL WHERE id=2") || ''));
  const p2 = db.prepare('SELECT estado FROM periodos_academicos WHERE id = 2').get();
  t.afirmar('16 la fecha final no cierra el período (sigue ABIERTO)', p2.estado === 'ABIERTO', p2.estado);
  t.afirmar('17 mismo año y nombre de período se rechaza', /UNIQUE/.test(error(db, "INSERT INTO periodos_academicos (anio_escolar, nombre, fecha_inicio, fecha_fin) VALUES (2026,'Primer trimestre','2026-02-01','2026-04-30')") || ''));
  t.afirmar('18 sección duplicada sin distinguir mayúsculas se rechaza', /UNIQUE/.test(error(db, "INSERT INTO secciones (materia_id, periodo_id, codigo) VALUES (1,1,'a')") || ''));
  db.close();

  console.log('== Cuentas vinculadas ==');
  db = nuevaBase({ conPreparacion: true });
  t.afirmar('19 profesor sin cuenta se rechaza', /NOT NULL/.test(error(db, "INSERT INTO profesores (usuario_id, cedula, nombre, apellido) VALUES (NULL,'9-300-300','Sin','Cuenta')") || ''));
  t.afirmar('20 dos profesores con la misma cuenta se rechazan', /UNIQUE/.test(error(db, "INSERT INTO profesores (usuario_id, cedula, nombre, apellido) VALUES (3,'9-400-400','Otro','Ruiz')") || ''));
  t.afirmar('21a un estudiante puede vincularse a una cuenta', error(db, 'UPDATE estudiantes SET usuario_id = 5 WHERE id = 1') === null);
  t.afirmar('21b dos estudiantes con la misma cuenta se rechazan', /UNIQUE/.test(error(db, 'UPDATE estudiantes SET usuario_id = 5 WHERE id = 3') || ''));
  db.close();

  console.log('== Integridad referencial: sin huérfanos ==');
  db = nuevaBase({ conPreparacion: true });
  db.exec("INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (1,1); INSERT INTO profesor_seccion (profesor_id, seccion_id) VALUES (1,1);");
  t.afirmar('22 inscripción en sección inexistente se rechaza', /FOREIGN KEY/.test(error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (1,999)") || ''));
  // Sección 4: solo tiene inscripciones de alumnos (sin asignaciones de profesor), para aislar la regla de estudiante_seccion
  db.exec("INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (1,4)");
  t.afirmar('23 borrar sección con inscripciones se rechaza', /FOREIGN KEY/.test(error(db, 'DELETE FROM secciones WHERE id = 4') || ''));
  t.afirmar('24 borrar estudiante con inscripciones se rechaza', /FOREIGN KEY/.test(error(db, 'DELETE FROM estudiantes WHERE id = 1') || ''));
  t.afirmar('25 borrar profesor con asignaciones se rechaza', /FOREIGN KEY/.test(error(db, 'DELETE FROM profesores WHERE id = 1') || ''));
  t.afirmar('26 rol no admitido se rechaza', /CHECK/.test(error(db, "INSERT INTO usuarios (nombre_usuario, password, rol) VALUES ('prueba.rol','h','SUPERVISOR')") || ''));
  const huerfanos = [
    'SELECT COUNT(*) n FROM calificaciones c LEFT JOIN estudiantes e ON e.id=c.estudiante_id LEFT JOIN materias m ON m.id=c.materia_id WHERE e.id IS NULL OR m.id IS NULL',
    'SELECT COUNT(*) n FROM secciones s LEFT JOIN materias m ON m.id=s.materia_id LEFT JOIN periodos_academicos p ON p.id=s.periodo_id WHERE m.id IS NULL OR p.id IS NULL',
    'SELECT COUNT(*) n FROM profesor_seccion ps LEFT JOIN profesores p ON p.id=ps.profesor_id LEFT JOIN secciones s ON s.id=ps.seccion_id WHERE p.id IS NULL OR s.id IS NULL',
    'SELECT COUNT(*) n FROM estudiante_seccion es LEFT JOIN estudiantes e ON e.id=es.estudiante_id LEFT JOIN secciones s ON s.id=es.seccion_id WHERE e.id IS NULL OR s.id IS NULL',
    'SELECT COUNT(*) n FROM profesores p LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE u.id IS NULL'
  ];
  t.afirmar('28 ninguna consulta de huérfanos devuelve filas', huerfanos.every(q => db.prepare(q).get().n === 0));
  db.close();

  console.log('== Conservación de los datos existentes y de la cuenta admin ==');
  db = nuevaBase();
  const despues = instantanea(db);
  const antes = db.antesMigracion;
  t.afirmar('27a estudiantes conservados (3, sin cambios)', JSON.stringify(antes.estudiantes) === JSON.stringify(despues.estudiantes) && despues.estudiantes.length === 3);
  t.afirmar('27b materias conservadas (5, sin cambios)', JSON.stringify(antes.materias) === JSON.stringify(despues.materias) && despues.materias.length === 5);
  t.afirmar('27c calificaciones conservadas (10, sin cambios)', JSON.stringify(antes.calificaciones) === JSON.stringify(despues.calificaciones) && despues.calificaciones.length === 10);
  t.afirmar('27d cuenta admin sin cambios (id, usuario y rol)', JSON.stringify(antes.admin) === JSON.stringify(despues.admin) && despues.admin[0].rol === 'ADMIN');
  t.afirmar('27e los estudiantes existentes no tienen cuenta vinculada', db.prepare('SELECT COUNT(*) n FROM estudiantes WHERE usuario_id IS NOT NULL').get().n === 0);
  t.afirmar('27f la migración admite los roles PROFESOR y ALUMNO', error(db, "INSERT INTO usuarios (nombre_usuario, password, rol) VALUES ('p.test','h','PROFESOR'),('a.test','h','ALUMNO')") === null);
  db.close();

  console.log('== Índice único sobre la columna generada ==');
  db = nuevaBase({ conPreparacion: true });
  db.exec("INSERT INTO estudiante_seccion (estudiante_id, seccion_id, estado, fecha_fin) VALUES (4,1,'FINALIZADA','2026-06-30')");
  t.afirmar('29 una inscripción FINALIZADA no ocupa el hueco de la activa', error(db, "INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (4,1)") === null);
  db.close();

  t.terminar();
})();
