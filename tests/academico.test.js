/* Etapa E · cálculos académicos (js/academico.js): valores esperados calculados a mano. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { probador } = require('./helpers');
const t = probador();

function cargarAcademico() {
  const ctx = { window: {} }; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'academico.js'), 'utf8'), ctx, { filename: 'academico.js' });
  return ctx.EC.academico;
}
const A = cargarAcademico();
const EV = [{ id: 1, peso: 30 }, { id: 2, peso: 30 }, { id: 3, peso: 40 }];

console.log('== Nota final: redondeo exacto ==');
let r = A.calcularNotaFinal(EV, { 1: 4.0, 2: 3.5, 3: 4.5 }, []);
t.afirmar('1.20 + 1.05 + 1.80 = 4.05 se redondea a 4.1', r.estado === A.ESTADO.CALCULADA && r.nota === '4.1', JSON.stringify(r));
r = A.calcularNotaFinal([{ id: 1, peso: 50 }, { id: 2, peso: 50 }], { 1: 4.0, 2: 4.0 }, []);
t.afirmar('4.0 con 50 % y 4.0 con 50 % dan 4.0', r.nota === '4.0', r.nota);
r = A.calcularNotaFinal([{ id: 1, peso: 50 }, { id: 2, peso: 50 }], { 1: 4.0, 2: 4.1 }, []);
t.afirmar('4.0 y 4.1 al 50 % dan 4.05, que se redondea a 4.1', r.nota === '4.1', r.nota);
r = A.calcularNotaFinal([{ id: 1, peso: 50 }, { id: 2, peso: 50 }], { 1: 4.0, 2: 4.0 }, []);
t.afirmar('no usa coma flotante: 3.0 con 33.33 % + 3.0 con 33.33 % + 3.0 con 33.34 % = 3.0', A.calcularNotaFinal([{ id: 1, peso: 33.33 }, { id: 2, peso: 33.33 }, { id: 3, peso: 33.34 }], { 1: 3.0, 2: 3.0, 3: 3.0 }, []).nota === '3.0');
t.afirmar('pesos que no suman 100 se rechazan', (() => { try { A.calcularNotaFinal([{ id: 1, peso: 60 }], { 1: 4 }, []); return false; } catch (e) { return /100/.test(e.message); } })());

console.log('== NO APLICA: renormalización (R-15) ==');
r = A.calcularNotaFinal(EV, { 1: 4.0, 3: 4.5 }, [2]);
t.afirmar('con el parcial 2 NO APLICA: (1.20 + 1.80) / 70 = 4.3', r.estado === A.ESTADO.CALCULADA && r.nota === '4.3', JSON.stringify(r));
t.afirmar('NO APLICA con nota registrada es un conflicto (no se decide en silencio)', (() => { try { A.calcularNotaFinal(EV, { 2: 3.5, 1: 4, 3: 4.5 }, [2]); return false; } catch (e) { return /conflicto/i.test(e.message); } })());
t.afirmar('todas NO APLICA: no hay nota, queda pendiente de resolución administrativa', (() => { const x = A.calcularNotaFinal(EV, {}, [1, 2, 3]); return x.estado === A.ESTADO.PENDIENTE_TODAS_NO_APLICA && x.nota === null; })());

console.log('== Falta de nota: nunca cero ni NO APLICA automático ==');
r = A.calcularNotaFinal(EV, { 1: 4.0 }, []);
t.afirmar('una nota que falta deja la nota pendiente', r.estado === A.ESTADO.PENDIENTE_SIN_NOTA && r.nota === null);
t.afirmar('las evaluaciones pendientes se identifican', JSON.stringify(r.pendientes) === '[2,3]', JSON.stringify(r.pendientes));
t.afirmar('la falta no cuenta como cero', A.calcularNotaFinal(EV, { 1: 4.0, 2: 4.0, 3: 4.0 }, []).nota === '4.0');

console.log('== Promedios: solo dentro de un ámbito ==');
t.afirmar('promedio de 4.0 y 3.0 es 3.50', A.promedio([40, 30]) === '3.50');
t.afirmar('promedio sin notas es null', A.promedio([]) === null);
const cal = [
  { estudiante_id: 1, materia_id: 1, seccion_id: 1, periodo_id: 1, origen: 'ACTUAL', nota: 4.0 },
  { estudiante_id: 1, materia_id: 2, seccion_id: 2, periodo_id: 1, origen: 'ACTUAL', nota: 3.0 },
  { estudiante_id: 1, materia_id: 1, seccion_id: 3, periodo_id: 2, origen: 'ACTUAL', nota: 2.0 },
  { estudiante_id: 1, materia_id: 1, seccion_id: null, periodo_id: null, origen: 'HEREDADA', nota: 5.0 }
];
t.afirmar('promedio del período 1 ignora el período 2 y el histórico', A.promedioPeriodo(cal, 1, 1) === '3.50', A.promedioPeriodo(cal, 1, 1));
t.afirmar('promedio del período 2 es solo su nota', A.promedioPeriodo(cal, 1, 2) === '2.00');
t.afirmar('el histórico va separado', A.notasHistoricas(cal).length === 1 && A.notasDelPeriodo(cal, 1).length === 2);

console.log('== Ranking y visibilidad (el alumno nunca ve rankings) ==');
const rk = A.ranking([
  { nombre: 'Lucía', apellido: 'Martínez', promedio: '3.00' },
  { nombre: 'Ana', apellido: 'Pérez', promedio: '4.22' },
  { nombre: 'Miguel', apellido: 'Rojas', promedio: null }
]);
t.afirmar('ranking ordenado por promedio y sin quien no tiene notas', rk.map(f => f.nombre).join() === 'Ana,Lucía');
t.afirmar('posiciones correlativas', rk[0].posicion === 1 && rk[1].posicion === 2);
t.afirmar('ADMIN ve rankings de cualquier ámbito', A.puedeVerRanking({ rol: 'ADMIN' }, 'periodo') === true);
t.afirmar('PROFESOR ve el ranking de su sección', A.puedeVerRanking({ rol: 'PROFESOR' }, 'seccion') === true);
t.afirmar('PROFESOR no ve ranking de período completo', A.puedeVerRanking({ rol: 'PROFESOR' }, 'periodo') === false);
t.afirmar('ALUMNO nunca ve rankings', A.puedeVerRanking({ rol: 'ALUMNO', estudianteId: 1 }, 'seccion') === false && A.puedeVerRanking({ rol: 'ALUMNO', estudianteId: 1 }, 'periodo') === false);

console.log('== Aislamiento: solo se devuelven los datos de la identidad indicada ==');
const todas = [
  { estudiante_id: 1, seccion_id: 1, nota: 4 }, { estudiante_id: 3, seccion_id: 1, nota: 3 },
  { estudiante_id: 4, seccion_id: 2, nota: 2 }
];
t.afirmar('ADMIN recibe todas', A.filtrarCalificaciones({ rol: 'ADMIN' }, todas).length === 3);
t.afirmar('PROFESOR solo recibe las notas de sus secciones', A.filtrarCalificaciones({ rol: 'PROFESOR', seccionesIds: [2] }, todas).map(c => c.estudiante_id).join() === '4');
t.afirmar('PROFESOR sin secciones no recibe nada', A.filtrarCalificaciones({ rol: 'PROFESOR', seccionesIds: [] }, todas).length === 0);
t.afirmar('ALUMNO solo recibe sus propias notas', A.filtrarCalificaciones({ rol: 'ALUMNO', estudianteId: 3 }, todas).map(c => c.nota).join() === '3');
t.afirmar('un rol desconocido no recibe nada', A.filtrarCalificaciones({ rol: 'INVENTADO' }, todas).length === 0);
t.afirmar('sin identidad no se recibe nada', A.filtrarCalificaciones(null, todas).length === 0);

t.terminar();
