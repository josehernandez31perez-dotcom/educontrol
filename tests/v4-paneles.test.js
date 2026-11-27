/* Etapa E v4 · Funciones PURAS de la interfaz: conciliación de cálculos, escape, exportación y visibilidad.
   No requiere navegador. El resto de la interfaz (DOM, fetch) queda marcado como NO PROBADO en el informe. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { probador } = require('./helpers');
const t = probador();

const ctx = { window: {}, document: undefined, Blob: undefined, URL: undefined };
ctx.window = ctx;
vm.createContext(ctx);
['js/academico.js', 'js/exportar.js', 'js/v4/cliente.js', 'js/v4/vistas.js', 'js/v4/paneles.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
const EC = ctx.EC;

console.log('== Conciliación de notas finales (cliente recalcula, servidor decide) ==');
const evaluaciones = [
  { evaluacion_id: 1, peso: 30, estudiante_id: 7, nota: 4.0, no_aplica: 0 },
  { evaluacion_id: 2, peso: 30, estudiante_id: 7, nota: 3.5, no_aplica: 0 },
  { evaluacion_id: 3, peso: 40, estudiante_id: 7, nota: 4.5, no_aplica: 0 },
  { evaluacion_id: 1, peso: 30, estudiante_id: 8, nota: 4.0, no_aplica: 0 },
  { evaluacion_id: 2, peso: 30, estudiante_id: 8, nota: null, no_aplica: 1 },
  { evaluacion_id: 3, peso: 40, estudiante_id: 8, nota: 4.5, no_aplica: 0 },
  { evaluacion_id: 1, peso: 30, estudiante_id: 9, nota: null, no_aplica: 0 },
  { evaluacion_id: 2, peso: 30, estudiante_id: 9, nota: 3.0, no_aplica: 0 },
  { evaluacion_id: 3, peso: 40, estudiante_id: 9, nota: 3.0, no_aplica: 0 }
];
const finales = [{ estudiante_id: 7, nota: 4.1 }, { estudiante_id: 8, nota: 4.3 }];
const conc = EC.v4Paneles.conciliarNotasFinales(evaluaciones, finales);
const a7 = conc.find(c => c.estudiante_id === 7), a8 = conc.find(c => c.estudiante_id === 8), a9 = conc.find(c => c.estudiante_id === 9);
t.afirmar('alumno 7: 4.05 recalculado = 4.1 del servidor, coincide', a7.cliente === '4.1' && a7.servidor === '4.1' && a7.coincide === true, JSON.stringify(a7));
t.afirmar('alumno 8: NO APLICA renormalizado = 4.3, coincide', a8.cliente === '4.3' && a8.coincide === true, JSON.stringify(a8));
t.afirmar('alumno 9: sin nota en una evaluación queda pendiente (no cero) y el servidor sin final: coincide', a9.cliente === EC.academico.ESTADO.PENDIENTE_SIN_NOTA && a9.servidor === 'SIN_FINAL' && a9.coincide === true, JSON.stringify(a9));
const discrepa = EC.v4Paneles.conciliarNotasFinales(evaluaciones, [{ estudiante_id: 7, nota: 4.0 }]).find(c => c.estudiante_id === 7);
t.afirmar('si el servidor diera 4.0 en lugar de 4.1, la conciliación lo marca como DIFERENCIA', discrepa.coincide === false && discrepa.cliente === '4.1' && discrepa.servidor === '4.0');
const pesosMal = EC.v4Paneles.conciliarNotasFinales([{ evaluacion_id: 1, peso: 60, estudiante_id: 5, nota: 4, no_aplica: 0 }], []);
t.afirmar('pesos que no suman 100 se reportan como ERROR, no se inventa una nota', pesosMal[0].cliente === 'ERROR' && pesosMal[0].coincide === false);

console.log('== Conciliación de promedios del alumno ==');
const promedios = EC.v4Paneles.conciliarPromedios(
  [{ origen: 'ACTUAL', periodo_id: 1, nota: 4.0 }, { origen: 'ACTUAL', periodo_id: 1, nota: 3.0 }, { origen: 'HEREDADA', periodo_id: null, nota: 5.0 }],
  [{ ambito: 'PERIODO', periodo_id: 1, promedio: '3.50' }, { ambito: 'HISTORICO', periodo_id: null, promedio: '5.00' }]);
t.afirmar('promedio del período 1 = 3.50 coincide; el histórico no se conciliaría con períodos', promedios.length === 1 && promedios[0].coincide === true && promedios[0].cliente === '3.50', JSON.stringify(promedios));

console.log('== Escape de datos en la interfaz ==');
const html = EC.vistas.tabla([{ nombre: '<img src=x onerror=alert(1)>' }], [{ clave: 'nombre', titulo: 'Nombre' }]);
t.afirmar('un nombre con HTML se muestra escapado, sin etiquetas activas', html.indexOf('<img') === -1 && html.indexOf('&lt;img') !== -1);
t.afirmar('el escape cubre comillas y ampersand', EC.v4.escapar('a&b "c" \'d\'') === 'a&amp;b &quot;c&quot; &#39;d&#39;');
t.afirmar('una tabla vacía muestra un mensaje, no una tabla vacía', EC.vistas.tabla([], [{ clave: 'x', titulo: 'X' }]).indexOf('Sin datos') !== -1);

console.log('== Exportación desde la tabla visible ==');
const filas = [{ alumno: 'Ana, Pérez', nota: '4.1' }];
const cols = [{ clave: 'alumno', titulo: 'Alumno' }, { clave: 'nota', titulo: 'Nota' }];
const csv = EC.vistas.exportarTabla('csv', 'Notas', filas, cols);
t.afirmar('CSV: tipo, nombre de archivo y contenido con la cabecera de la tabla', csv.tipo === 'text/csv' && csv.nombre === 'Notas.csv' && csv.datos.indexOf('Alumno;Nota') !== -1 && csv.datos.indexOf('"Ana, Pérez"') === -1 && csv.datos.indexOf('Ana, Pérez;4.1') !== -1);
const xls = EC.vistas.exportarTabla('xlsx', 'Notas', filas, cols);
t.afirmar('XLSX: es un ZIP (cabecera PK) con nombre .xlsx', xls.nombre === 'Notas.xlsx' && xls.datos[0] === 0x50 && xls.datos[1] === 0x4B);
const pdf = EC.vistas.exportarTabla('pdf', 'Notas', filas, cols);
t.afirmar('PDF: cabecera %PDF y nombre .pdf', pdf.nombre === 'Notas.pdf' && String.fromCharCode(...pdf.datos.slice(0, 4)) === '%PDF');
t.afirmar('un formato desconocido se rechaza', (() => { try { EC.vistas.exportarTabla('docx', 'x', filas, cols); return false; } catch (e) { return /no soportado/.test(e.message); } })());

console.log('== Visibilidad: lo que cada panel declara ==');
const lecturas = EC.v4Paneles.LECTURAS;
const colsAlumno = JSON.stringify(lecturas.alumno);
t.afirmar('ningún panel del alumno pide rankings ni posiciones', !/ranking|posicion/i.test(colsAlumno) && lecturas.alumno.every(l => !/ranking/.test(l.accion)));
t.afirmar('el panel del alumno solo usa acciones alum.* (ningún dato de otros)', lecturas.alumno.every(l => /^alum\./.test(l.accion)));
t.afirmar('el panel del profesor usa solo acciones prof.* en sus lecturas', lecturas.profesor.every(l => /^prof\./.test(l.accion)));
t.afirmar('el panel de administración usa acciones admin.* en sus lecturas', lecturas.admin.every(l => /^admin\./.test(l.accion)));
t.afirmar('ningún formulario de ADMIN usa acciones de profesor o alumno', EC.v4Paneles.FORMULARIOS.admin.every(b => b.acciones.every(a => /^admin\./.test(a.accion))));
t.afirmar('ningún formulario de PROFESOR usa acciones de administración', EC.v4Paneles.FORMULARIOS.profesor.every(b => b.acciones.every(a => /^prof\./.test(a.accion))));
t.afirmar('ningún campo de formulario pide identidad (usuario actual, rol)', [...EC.v4Paneles.FORMULARIOS.admin, ...EC.v4Paneles.FORMULARIOS.profesor]
  .every(b => b.acciones.every(a => a.campos.every(c => !/^(usuario_actual|rol|actor)$/.test(c.nombre)))));

t.terminar();
