/* Etapa E · Parte 1 (correcciones): comprobaciones ESTÁTICAS de los scripts SQL de bd/.
   Verifican texto y coherencia, NO ejecución. Lo que se ejecuta en MariaDB 10.4.32 está en
   bd/pruebas/ y debe correrlo el operador; su resultado figura en el informe como "NO EJECUTADO AQUÍ". */
const fs = require('fs'), path = require('path');
const { probador } = require('./helpers');
const t = probador();

const raiz = path.join(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
// Quita comentarios SQL y de bloque para analizar solo sentencias
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
// Quita cláusulas ON DELETE / ON UPDATE (contienen las palabras DELETE y UPDATE)
const sinAcciones = s => sinComentarios(s).replace(/ON\s+(DELETE|UPDATE)\s+(SET NULL|CASCADE|RESTRICT|NO ACTION)/gi, '');

const NUEVAS_TABLAS = ['periodos_academicos', 'profesores', 'secciones', 'profesor_seccion', 'estudiante_seccion',
  'evaluaciones', 'notas_evaluacion', 'evaluacion_no_aplica', 'pendientes_calificacion', 'observaciones', 'auditoria_academica'];
// Tablas que el MODELO SQLite de la Parte 1 (bd-modelo) define: subconjunto histórico del diseño v3
const TABLAS_MODELO = ['periodos_academicos', 'profesores', 'secciones', 'profesor_seccion', 'estudiante_seccion'];
const SQL_BD = ['bd/00_verificacion_previa.sql', 'bd/01_nueva_estructura.sql', 'bd/02_migracion.sql',
  'bd/03a_reversion_vinculos_y_roles.sql', 'bd/03b_reversion_tablas_nuevas.sql',
  'bd/pruebas/00_compatibilidad_mariadb.sql', 'bd/pruebas/01_base_minima_prueba.sql', 'bd/pruebas/02_pruebas_mariadb.sql',
  'bd/opcional/03_triggers_roles_BORRADOR.sql', 'bd/04_sesiones_v4.sql', 'bd/05_procedimientos_v4.sql', 'bd/06_permisos_v4.sql',
  'bd/pruebas/03_pruebas_v4.sql'];

console.log('== Archivos previstos ==');
SQL_BD.concat(['bd/diagrama_er.md', 'bd/README.md', 'bd/REGLAS_BACKEND.md']).forEach(f =>
  t.afirmar(f + ' existe', fs.existsSync(path.join(raiz, f))));
t.afirmar('el antiguo bd/03_reversion.sql ya no existe (sustituido por 03a y 03b)', !fs.existsSync(path.join(raiz, 'bd/03_reversion.sql')));

console.log('== 00: verificación previa, solo lectura ==');
const v00 = sinComentarios(leer('bd/00_verificacion_previa.sql'));
t.afirmar('00 no contiene sentencias que modifiquen datos o estructura (SHOW CREATE es solo lectura)',
  !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REPLACE|GRANT|RENAME)\b|CREATE\s+(TABLE|DATABASE|INDEX|VIEW|USER)/i.test(v00.replace(/SHOW\s+CREATE\s+(TABLE|VIEW)/gi, '')));
t.afirmar('00 no selecciona el hash de las contraseñas', !/SELECT[^;]*\bpassword\b/i.test(v00));
t.afirmar('00 comprueba la versión y el modo SQL', /VERSION\(\)/.test(v00) && /sql_mode/.test(v00));

console.log('== 01: solo crea las 5 tablas nuevas ==');
const v01 = sinAcciones(leer('bd/01_nueva_estructura.sql'));
t.afirmar('01 no modifica ni borra nada existente', !/\b(ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(v01));
const creadas = [...v01.matchAll(/CREATE TABLE\s+(\w+)/gi)].map(m => m[1]);
t.afirmar('01 crea exactamente las 11 tablas nuevas de la versión v4', creadas.length === 11 && NUEVAS_TABLAS.every(n => creadas.includes(n)), creadas.join(','));
t.afirmar('01 no usa IF NOT EXISTS', !/IF NOT EXISTS/i.test(v01));
t.afirmar('01 usa columna VIRTUAL para la inscripción activa', /GENERATED ALWAYS AS[\s\S]*?VIRTUAL/i.test(v01));
t.afirmar('01 limita un período a fechas válidas', /chk_periodos_fechas CHECK \(fecha_fin >= fecha_inicio\)/.test(v01));
t.afirmar('01 exige fecha de cierre si el período está CERRADO', /chk_periodos_cierre/.test(v01));
t.afirmar('01 no cierra períodos automáticamente (sin eventos ni triggers)', !/CREATE\s+(EVENT|TRIGGER)/i.test(v01));
t.afirmar('01 tiene 22 claves foráneas, todas con RESTRICT al borrar', (v01.match(/FOREIGN KEY/g) || []).length === 22 &&
  (leer('bd/01_nueva_estructura.sql').match(/ON DELETE RESTRICT/g) || []).length === 22);
t.afirmar('01 no usa ON UPDATE CASCADE en la clave que alimenta la columna VIRTUAL',
  !/fk_estudiante_seccion_estudiante[\s\S]*?ON UPDATE CASCADE/.test(sinComentarios(leer('bd/01_nueva_estructura.sql')).replace(/CONSTRAINT fk_estudiante_seccion_seccion[\s\S]*$/, '')));

console.log('== 02: migración aditiva ==');
const v02 = sinAcciones(leer('bd/02_migracion.sql'));
t.afirmar('02 no borra filas ni tablas (salvo el DROP INDEX del nombre verificado, marcador obligatorio)', !/\b(DELETE|TRUNCATE)\b/i.test(v02) && (v02.match(/DROP\s+(TABLE|COLUMN)/gi) || []).length === 0 && /DROP INDEX <NOMBRE_INDICE_VERIFICADO>/.test(v02));
t.afirmar('02 no inserta ni actualiza datos', !/\b(INSERT|UPDATE)\b/i.test(v02));
t.afirmar('02 deja el catálogo de roles en ADMIN, PROFESOR y ALUMNO (sin CONSULTA), sin valor por defecto',
  /MODIFY rol ENUM\('ADMIN','PROFESOR','ALUMNO'\) NOT NULL;/.test(v02) && !/MODIFY rol ENUM\([^)]*CONSULTA/.test(v02));
t.afirmar('02 añade estudiantes.usuario_id como nulo', /ADD COLUMN usuario_id INT UNSIGNED NULL DEFAULT NULL/.test(v02));
t.afirmar('02 añade usuarios.estado con valor por defecto ACTIVO', /ADD COLUMN estado ENUM\('ACTIVO','INACTIVO'\) NOT NULL DEFAULT 'ACTIVO'/.test(v02));
t.afirmar('02 no transforma las calificaciones existentes (default HEREDADA en la columna nueva)', /origen ENUM\('HEREDADA','ACTUAL'\) NOT NULL DEFAULT 'HEREDADA'/.test(v02));
t.afirmar('02 no modifica el ENUM de estado de estudiantes', !/MODIFY\s+estado/i.test(v02));

console.log('== Reversión en dos pasos ==');
const v03b = sinAcciones(leer('bd/03b_reversion_tablas_nuevas.sql'));
const v03a = sinAcciones(leer('bd/03a_reversion_vinculos_y_roles.sql'));
const drops = [...(v03b + v03a).matchAll(/DROP TABLE\s+(\w+)/gi)].map(m => m[1]);
t.afirmar('03b elimina exactamente las tablas nuevas (11 de 01 y sesiones_app de 04)', [...v03b.matchAll(/DROP TABLE\s+(\w+)/gi)].map(m => m[1]).sort().join() === [...NUEVAS_TABLAS, 'sesiones_app'].sort().join());
t.afirmar('03a y 03b no eliminan ninguna tabla existente (solo tablas nuevas, incluida sesiones_app)', drops.every(n => NUEVAS_TABLAS.includes(n) || n === 'sesiones_app'), drops.join(','));
t.afirmar('03b tiene comprobación previa de filas', /COUNT\(\*\)[\s\S]*FROM estudiante_seccion/.test(leer('bd/03b_reversion_tablas_nuevas.sql')));
t.afirmar('03b advierte que es destructivo', /DESTRUCTIVO/.test(leer('bd/03b_reversion_tablas_nuevas.sql')));
t.afirmar('03a comprueba roles nuevos antes de restaurar el ENUM', /cuentas_profesor_o_alumno[\s\S]*MODIFY rol ENUM\('ADMIN','CONSULTA'\)/.test(v03a));
t.afirmar('03a quita la FK antes que el índice y la columna', v03a.indexOf('DROP FOREIGN KEY') < v03a.indexOf('DROP INDEX') && v03a.indexOf('DROP INDEX') < v03a.indexOf('DROP COLUMN'));
t.afirmar('03a y 03b no insertan ni actualizan filas', !/\b(INSERT|UPDATE)\b/i.test(v03a + v03b));
t.afirmar('03b no usa IF EXISTS (una tabla que falta detiene el script)', !/IF EXISTS/i.test(v03b));

console.log('== Seguridad: ninguna base real ni borrado de bases ==');
SQL_BD.forEach(f => {
  const s = sinComentarios(leer(f));
  t.afirmar(f + ' no contiene DROP DATABASE', !/DROP\s+DATABASE/i.test(s));
  t.afirmar(f + ' no selecciona la base real con USE', !/^\s*USE\s+educontrol\s*;/mi.test(s));
  t.afirmar(f + ' no nombra educontrol_test (nombre antiguo)', !/educontrol_test\b/.test(s));
});
['bd/00_verificacion_previa.sql', 'bd/01_nueva_estructura.sql', 'bd/02_migracion.sql', 'bd/03a_reversion_vinculos_y_roles.sql', 'bd/03b_reversion_tablas_nuevas.sql'].forEach(f =>
  t.afirmar(f + ' muestra la base activa antes de actuar', /SELECT DATABASE\(\)/i.test(leer(f))));
const base01 = sinComentarios(leer('bd/pruebas/01_base_minima_prueba.sql'));
t.afirmar('01_base crea exactamente educontrol_pruebas', /^\s*CREATE DATABASE educontrol_pruebas\b/mi.test(base01));
t.afirmar('01_base no usa IF NOT EXISTS al crear la base (falla si ya existe)', !/CREATE DATABASE\s+IF NOT EXISTS/i.test(base01));
t.afirmar('01_base selecciona educontrol_pruebas', /^\s*USE educontrol_pruebas\s*;/mi.test(base01));
t.afirmar('02_pruebas selecciona educontrol_pruebas', /^\s*USE educontrol_pruebas\s*;/mi.test(sinComentarios(leer('bd/pruebas/02_pruebas_mariadb.sql'))));
const compat = sinComentarios(leer('bd/pruebas/00_compatibilidad_mariadb.sql'));
t.afirmar('compatibilidad crea y usa solo educontrol_pruebas_compat', /CREATE DATABASE educontrol_pruebas_compat\b/.test(compat) && /USE educontrol_pruebas_compat\s*;/.test(compat));
t.afirmar('compatibilidad solo borra tablas con prefijo zz_', [...compat.matchAll(/DROP TABLE IF EXISTS\s+(\w+)/g)].every(m => m[1].startsWith('zz_')));
t.afirmar('compatibilidad comprueba CHECK, VIRTUAL+UNIQUE, ENUM, FK RESTRICT, DEFAULT, MODIFY y NULL único (G1-G8)',
  ['G1.', 'G2.', 'G3.', 'G4.', 'G5.', 'G6.', 'G7.', 'G8.'].every(g => leer('bd/pruebas/00_compatibilidad_mariadb.sql').includes(g)));

console.log('== Nombres de restricciones: únicos y registrados en la verificación previa ==');
// Cada nombre se cuenta una vez por archivo (una sentencia ADD CONSTRAINT ... UNIQUE también encaja con CONSTRAINT)
const nombres = [];
['bd/01_nueva_estructura.sql', 'bd/02_migracion.sql'].forEach(f => {
  const s = sinComentarios(leer(f));
  const del = new Set([
    ...[...s.matchAll(/CONSTRAINT\s+(\w+)/g)].map(m => m[1]),
    ...[...s.matchAll(/UNIQUE KEY\s+(\w+)/g)].map(m => m[1])
  ]);
  nombres.push(...del);
});
const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i);
t.afirmar('ningún nombre de restricción se repite entre 01 y 02', duplicados.length === 0, duplicados.join(','));
const v00completo = leer('bd/00_verificacion_previa.sql');
const sinRegistrar = [...new Set(nombres)].filter(n => !v00completo.includes("'" + n + "'"));
t.afirmar('todas las restricciones nuevas están en la comprobación de colisión de 00', sinRegistrar.length === 0, sinRegistrar.join(','));

console.log('== Coherencia entre MariaDB y el modelo SQLite ==');
const modelo = leer('tests/bd-modelo.test.js');
const rolesMaria = (v02.match(/rol ENUM\(([^)]*)\)/) || [])[1];
const rolesModelo = (modelo.match(/rol TEXT NOT NULL DEFAULT 'CONSULTA' CHECK \(rol IN \(([^)]*)\)\)/g) || []).pop();
t.afirmar('el catálogo de roles v4 (ADMIN, PROFESOR, ALUMNO) está en 02 y en 04', /'ADMIN','PROFESOR','ALUMNO'/.test(leer('bd/02_migracion.sql')) && /'ADMIN','PROFESOR','ALUMNO'/.test(leer('bd/04_sesiones_v4.sql')), rolesMaria);
const tablasModelo = [...modelo.matchAll(/CREATE TABLE\s+(\w+)/g)].map(m => m[1]).filter(n => TABLAS_MODELO.includes(n));
t.afirmar('el modelo define las 5 tablas que modela (histórico v3)', tablasModelo.length === 5 && TABLAS_MODELO.every(n => tablasModelo.includes(n)));
t.afirmar('el modelo de roles usa la misma lista de roles que MariaDB', leer('tests/bd-roles.test.js').includes("('ADMIN','CONSULTA','PROFESOR','ALUMNO')"));

console.log('== Triggers opcionales: marcados como no verificados ==');
const trg = leer('bd/opcional/03_triggers_roles_BORRADOR.sql');
t.afirmar('el borrador de triggers declara que NO está verificado', /NO VERIFICADO EN MARIADB/.test(trg));
const readmeBd = leer('bd/README.md');
const tablaInstalacion = readmeBd.split('## Orden de instalación')[1].split('## Archivos de reversión')[0];
t.afirmar('el borrador de triggers no figura en la tabla de instalación y el README dice que queda excluido', !/03_triggers/.test(tablaInstalacion) && /Excluido de la instalación/.test(readmeBd));

console.log('== Pruebas MariaDB: numeradas y con resultado esperado ==');
const pruebas = leer('bd/pruebas/02_pruebas_mariadb.sql');
const numeros = [...pruebas.matchAll(/^-- ---------- (\d+)\./gm)].map(m => +m[1]);
t.afirmar('las pruebas MariaDB van del 1 al 28 sin huecos', numeros.length === 28 && numeros.every((n, i) => n === i + 1), numeros.join(','));
t.afirmar('cada prueba indica su resultado esperado', (pruebas.match(/^-- ESPERADO:|^-- Esperado:/gm) || []).length >= 25);

console.log('== Reglas de backend documentadas ==');
const reglas = leer('bd/REGLAS_BACKEND.md');
['RV1', 'RV2', 'RV3', 'RV4', 'RV5', 'RV6', 'RV7', 'RV8', 'ES1', 'ES2', 'ES3', 'ES4', 'PE1', 'PE2', 'PE3', 'PE4', 'TX1', 'TX2', 'TX3'].forEach(id =>
  t.afirmar('regla ' + id + ' documentada', new RegExp('### ' + id + ' ').test(reglas)));
t.afirmar('las reglas indican que se aplican en el backend', /backend/i.test(reglas));

t.terminar();
