/* Comprobaciones estáticas de la API de lectura de calificaciones (ampliación compatible). */
const fs = require('fs'), path = require('path');
const { probador } = require('./helpers');
const t = probador();

const php = fs.readFileSync(path.join(__dirname, '..', 'api', 'listar_calificaciones.php'), 'utf8').replace(/\r/g, '');
const select = php.slice(php.indexOf('$sql = "SELECT'), php.indexOf('$consulta'));

console.log('== Compatibilidad: campos existentes ==');
['c.id', 'e.nombre AS estudiante', 'e.apellido', 'm.nombre AS materia', 'c.nota', 'c.fecha_registro'].forEach(campo =>
  t.afirmar('sigue devolviendo ' + campo, select.includes(campo)));

console.log('== Ampliación: campos nuevos ==');
['c.estudiante_id', 'c.materia_id', 'e.cedula'].forEach(campo =>
  t.afirmar('devuelve ' + campo, select.includes(campo)));
t.afirmar('devuelve e.nombre como nombre del estudiante', /\be\.nombre\s*\n?\s*FROM/.test(select) || /,\s*e\.nombre\s*\n/.test(select));

console.log('== Seguridad y solo lectura ==');
t.afirmar('exige sesión', php.includes('requerir_sesion();'));
t.afirmar('no escribe en la base de datos', !/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(php));
t.afirmar('la consulta no usa concatenación de datos del usuario', !/\$_(GET|POST|REQUEST)/.test(php));
t.afirmar('la respuesta es JSON', php.includes('json_encode'));

t.terminar();
