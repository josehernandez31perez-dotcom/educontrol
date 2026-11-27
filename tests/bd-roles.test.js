/* Etapa E · Parte 1 (correcciones): LÓGICA de los triggers de roles del borrador
   bd/opcional/03_triggers_roles_BORRADOR.sql, reproducida en SQLite (node:sqlite).
   ATENCIÓN: esto valida la LÓGICA del diseño, no el código de MariaDB. La sintaxis de los triggers
   de MariaDB 10.4.32 NO está verificada. Sin esa verificación el borrador no se instala. */
const { probador } = require('./helpers');
const t = probador();

const emitir = process.emitWarning;
process.emitWarning = () => {};
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = emitir;

const DDL = `
  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'CONSULTA' CHECK (rol IN ('ADMIN','CONSULTA','PROFESOR','ALUMNO'))
  );
  CREATE TABLE profesores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    cedula TEXT NOT NULL UNIQUE
  );
  CREATE TABLE estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL UNIQUE,
    usuario_id INTEGER NULL UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
  );
  -- Equivalentes SQLite de los triggers del borrador (RAISE(ABORT) equivale a SIGNAL SQLSTATE '45000')
  CREATE TRIGGER trg_profesores_rol_bi BEFORE INSERT ON profesores FOR EACH ROW
  BEGIN SELECT RAISE(ABORT, 'El usuario vinculado a un profesor debe tener rol PROFESOR')
    WHERE (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) IS NOT 'PROFESOR'; END;
  CREATE TRIGGER trg_profesores_rol_bu BEFORE UPDATE ON profesores FOR EACH ROW
  BEGIN SELECT RAISE(ABORT, 'El usuario vinculado a un profesor debe tener rol PROFESOR')
    WHERE (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) IS NOT 'PROFESOR'; END;
  CREATE TRIGGER trg_estudiantes_rol_bi BEFORE INSERT ON estudiantes FOR EACH ROW
  BEGIN SELECT RAISE(ABORT, 'El usuario vinculado a un alumno debe tener rol ALUMNO')
    WHERE NEW.usuario_id IS NOT NULL AND (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) IS NOT 'ALUMNO'; END;
  CREATE TRIGGER trg_estudiantes_rol_bu BEFORE UPDATE ON estudiantes FOR EACH ROW
  BEGIN SELECT RAISE(ABORT, 'El usuario vinculado a un alumno debe tener rol ALUMNO')
    WHERE NEW.usuario_id IS NOT NULL AND (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) IS NOT 'ALUMNO'; END;
  CREATE TRIGGER trg_usuarios_rol_bu BEFORE UPDATE ON usuarios FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'No se puede cambiar el rol de un usuario vinculado a un profesor')
      WHERE OLD.rol = 'PROFESOR' AND NEW.rol <> OLD.rol AND EXISTS (SELECT 1 FROM profesores WHERE usuario_id = OLD.id);
    SELECT RAISE(ABORT, 'No se puede cambiar el rol de un usuario vinculado a un alumno')
      WHERE OLD.rol = 'ALUMNO' AND NEW.rol <> OLD.rol AND EXISTS (SELECT 1 FROM estudiantes WHERE usuario_id = OLD.id);
  END;
`;

function base(conTriggers = true) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const ddl = conTriggers ? DDL : DDL.replace(/CREATE TRIGGER[\s\S]*?END;/g, '');
  db.exec(ddl);
  db.exec(`INSERT INTO usuarios (id, nombre_usuario, password, rol) VALUES
    (1,'admin','HASH_FICTICIO','ADMIN'),(2,'consulta','HASH_FICTICIO','CONSULTA'),
    (3,'carlos.ruiz','HASH_FICTICIO','PROFESOR'),(4,'ana.perez','HASH_FICTICIO','ALUMNO'),
    (5,'otro.profe','HASH_FICTICIO','PROFESOR'),(6,'sin.vinculo','HASH_FICTICIO','ALUMNO');`);
  return db;
}

function error(db, sql) {
  try { db.exec(sql); return null; } catch (e) { return e.message; }
}

(() => {
  console.log('== Profesores: la cuenta debe tener rol PROFESOR ==');
  let db = base();
  t.afirmar('R1 profesor vinculado a cuenta PROFESOR se admite', error(db, "INSERT INTO profesores (usuario_id, cedula) VALUES (3,'9-100-100')") === null);
  t.afirmar('R2 profesor vinculado a cuenta CONSULTA se rechaza', /rol PROFESOR/.test(error(db, "INSERT INTO profesores (usuario_id, cedula) VALUES (2,'9-200-200')") || ''));
  t.afirmar('R3 profesor vinculado a cuenta ALUMNO se rechaza', /rol PROFESOR/.test(error(db, "INSERT INTO profesores (usuario_id, cedula) VALUES (4,'9-300-300')") || ''));
  t.afirmar('R4 cambiar un profesor a cuenta ALUMNO se rechaza', /rol PROFESOR/.test(error(db, 'UPDATE profesores SET usuario_id = 4 WHERE usuario_id = 3') || ''));
  db.close();

  console.log('== Alumnos: si hay vínculo, la cuenta debe tener rol ALUMNO; NULL permitido ==');
  db = base();
  t.afirmar('R5a alumno sin cuenta se admite', error(db, "INSERT INTO estudiantes (cedula, usuario_id) VALUES ('8-100-100', NULL)") === null);
  t.afirmar('R5b alumno vinculado a cuenta ALUMNO se admite', error(db, "INSERT INTO estudiantes (cedula, usuario_id) VALUES ('8-200-200', 6)") === null);
  t.afirmar('R5c alumno vinculado a cuenta PROFESOR se rechaza', /rol ALUMNO/.test(error(db, "INSERT INTO estudiantes (cedula, usuario_id) VALUES ('8-300-300', 3)") || ''));
  t.afirmar('R5d cambiar un alumno a cuenta PROFESOR se rechaza', /rol ALUMNO/.test(error(db, 'UPDATE estudiantes SET usuario_id = 5 WHERE cedula = \'8-200-200\'') || ''));
  db.close();

  console.log('== Cambio de rol de cuentas vinculadas ==');
  db = base();
  db.exec("INSERT INTO profesores (usuario_id, cedula) VALUES (3,'9-100-100'); INSERT INTO estudiantes (cedula, usuario_id) VALUES ('8-200-200', 4);");
  t.afirmar('R6a cambiar rol de profesor vinculado se rechaza', /vinculado a un profesor/.test(error(db, "UPDATE usuarios SET rol = 'CONSULTA' WHERE id = 3") || ''));
  t.afirmar('R6b cambiar rol de alumno vinculado se rechaza', /vinculado a un alumno/.test(error(db, "UPDATE usuarios SET rol = 'CONSULTA' WHERE id = 4") || ''));
  t.afirmar('R6c cambiar rol de cuenta sin vínculo se admite', error(db, "UPDATE usuarios SET rol = 'CONSULTA' WHERE id = 6") === null);
  t.afirmar('R6d la cuenta vinculada conserva su rol tras los intentos', db.prepare('SELECT rol FROM usuarios WHERE id = 3').get().rol === 'PROFESOR');
  db.close();

  console.log('== La cuenta admin no se ve afectada ==');
  db = base();
  t.afirmar('R7 el rol de admin no se modifica al validar roles', db.prepare('SELECT rol FROM usuarios WHERE id = 1').get().rol === 'ADMIN');
  db.close();

  console.log('== Sin triggers, las reglas no se cumplen (comprueba que la prueba no es vacía) ==');
  db = base(false);
  t.afirmar('R8 sin trigger, un profesor con cuenta CONSULTA sí se acepta (demuestra la necesidad)', error(db, "INSERT INTO profesores (usuario_id, cedula) VALUES (2,'9-200-200')") === null);
  db.close();

  t.terminar();
})();
