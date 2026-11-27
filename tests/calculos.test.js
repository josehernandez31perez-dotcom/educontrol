/* Pruebas unitarias del módulo puro js/calculos.js (sin localStorage). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { probador } = require('./helpers');
const t = probador();

const ventana = { }; ventana.window = ventana;
const ctx = vm.createContext(ventana);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'calculos.js'), 'utf8'), ctx, { filename: 'calculos.js' });
const C = ctx.EC.calculosAcademicos;
const aprueba30 = v => v >= 3.0;

console.log('== Promedio ==');
t.afirmar('promedio simple de notas', C.promedioDeEstudiante([{ estudiante_id: 1, nota: 4 }, { estudiante_id: 1, nota: 3 }], 1) === 3.5);
t.afirmar('promedio se redondea a 2 decimales', C.promedioDeEstudiante([{ estudiante_id: 1, nota: 4.5 }, { estudiante_id: 1, nota: 4 }, { estudiante_id: 1, nota: 3.8 }, { estudiante_id: 1, nota: 4.2 }, { estudiante_id: 1, nota: 4.6 }], 1) === 4.22);
t.afirmar('sin notas devuelve null (no cero)', C.promedioDeEstudiante([], 1) === null);
t.afirmar('ignora notas de otros estudiantes', C.promedioDeEstudiante([{ estudiante_id: 2, nota: 1 }], 1) === null);
t.afirmar('acepta el id como texto', C.promedioDeEstudiante([{ estudiante_id: 1, nota: 5 }], '1') === 5);

console.log('== Estado académico y límite de aprobación ==');
t.afirmar('2.99 reprueba', C.estadoAcademico(2.99, aprueba30) === 'REPROBADO');
t.afirmar('3.00 aprueba (límite exacto)', C.estadoAcademico(3.0, aprueba30) === 'APROBADO');
t.afirmar('3.01 aprueba', C.estadoAcademico(3.01, aprueba30) === 'APROBADO');
t.afirmar('null es SIN NOTAS', C.estadoAcademico(null, aprueba30) === 'SIN NOTAS');
t.afirmar('usa el predicado recibido (aprobación 3.5)', C.estadoAcademico(3.2, v => v >= 3.5) === 'REPROBADO');
t.afirmar('no depende de localStorage ni de EC.configuracion', typeof ctx.localStorage === 'undefined');

console.log('== Resumen y ranking ==');
const estudiantes = [
  { id: 1, cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO' },
  { id: 3, cedula: '8-300-300', nombre: 'Lucía', apellido: 'Martínez', estado: 'ACTIVO' },
  { id: 4, cedula: '8-400-400', nombre: 'Miguel', apellido: 'Rojas', estado: 'ACTIVO' }
];
const notas = [
  { estudiante_id: 1, nota: 4.5 }, { estudiante_id: 1, nota: 4.0 }, { estudiante_id: 1, nota: 3.8 },
  { estudiante_id: 1, nota: 4.2 }, { estudiante_id: 1, nota: 4.6 },
  { estudiante_id: 3, nota: 3.0 }, { estudiante_id: 3, nota: 3.0 }, { estudiante_id: 3, nota: 3.0 },
  { estudiante_id: 3, nota: 3.0 }, { estudiante_id: 3, nota: 3.0 }
];
const r = C.resumen(estudiantes, notas, aprueba30);
t.afirmar('ranking: Ana primera, Lucía segunda, Miguel al final', r.map(x => x.nombre).join(',') === 'Ana,Lucía,Miguel');
t.afirmar('Miguel sin notas: promedio null y SIN NOTAS', r[2].promedio === null && r[2].estado_academico === 'SIN NOTAS');
t.afirmar('cantidad de notas por estudiante', r[0].cantidad === 5 && r[2].cantidad === 0);
t.afirmar('resumenDeEstudiante encuentra por id', C.resumenDeEstudiante(r, 3).nombre === 'Lucía');
t.afirmar('resumenDeEstudiante sin resultado es null', C.resumenDeEstudiante(r, 99) === null);
t.afirmar('notasDeEstudiante filtra por estudiante', C.notasDeEstudiante([{ estudiante_id: 1 }, { estudiante_id: 3 }], 3).length === 1);
t.afirmar('no modifica la lista de estudiantes', estudiantes[0].nombre === 'Ana' && estudiantes.length === 3);

console.log('== Búsqueda sin tildes ==');
t.afirmar('"ana" encuentra a Ana', C.buscar(r, 'ana').map(x => x.nombre).join() === 'Ana');
t.afirmar('"LUCIA" encuentra a Lucía', C.buscar(r, 'LUCIA').map(x => x.nombre).join() === 'Lucía');
t.afirmar('"pérez" encuentra a Pérez', C.buscar(r, 'pérez').map(x => x.apellido).join() === 'Pérez');
t.afirmar('cédula parcial', C.buscar(r, '300-300').map(x => x.nombre).join() === 'Lucía');
t.afirmar('término vacío devuelve todos', C.buscar(r, '').length === 3);
t.afirmar('término sin coincidencias', C.buscar(r, 'zzz').length === 0);

console.log('== Estadísticas ==');
const e = C.estadisticas(r, 5);
t.afirmar('totales y aprobados/reprobados/sin notas', e.totalEstudiantes === 3 && e.aprobados === 2 && e.reprobados === 0 && e.sinNotas === 1);
t.afirmar('promedio general ponderado por estudiante con notas (3.61)', e.promedioGeneral === 3.61);
t.afirmar('mejor promedio es Ana', e.mejor.nombre === 'Ana');
t.afirmar('menor promedio es Lucía (sin contar a Miguel)', e.menor.nombre === 'Lucía');
t.afirmar('ranking excluye sin notas', e.ranking.length === 2);
t.afirmar('sinNotasLista contiene a Miguel', e.sinNotasLista.length === 1 && e.sinNotasLista[0].nombre === 'Miguel');
const vacio = C.estadisticas([], 5);
t.afirmar('sin estudiantes: promedio, mejor y menor son null', vacio.promedioGeneral === null && vacio.mejor === null && vacio.menor === null);

t.terminar();
