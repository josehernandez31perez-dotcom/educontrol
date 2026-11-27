/* Paridad: los resultados de storage.js (datos locales) deben coincidir con los valores de referencia
   obtenidos del código anterior a la extracción de calculos.js. */
const { crearEntorno, probador } = require('./helpers');
const t = probador();
const { EC, almacen } = crearEntorno();

// Valores de referencia del código anterior (datos de demostración del proyecto)
const REFERENCIA = {
  resumen: [
    { id: 1, nombre: 'Ana', promedio: 4.22, estado: 'APROBADO', cantidad: 5 },
    { id: 3, nombre: 'Lucía', promedio: 3, estado: 'APROBADO', cantidad: 5 },
    { id: 4, nombre: 'Miguel', promedio: null, estado: 'SIN NOTAS', cantidad: 0 }
  ],
  totalEstudiantes: 3, totalMaterias: 5, aprobados: 2, reprobados: 0, sinNotas: 1,
  promedioGeneral: 3.61, mejor: 'Ana', menor: 'Lucía',
  buscarAna: ['Ana'], buscarLucia: ['Lucía']
};

console.log('== Datos de demostración (inicialización) ==');
const resumen = EC.calculos.resumen().map(x => ({ id: x.id, nombre: x.nombre, promedio: x.promedio, estado: x.estado_academico, cantidad: x.cantidad }));
t.afirmar('resumen coincide con la referencia', JSON.stringify(resumen) === JSON.stringify(REFERENCIA.resumen), JSON.stringify(resumen));
const est = EC.calculos.estadisticas();
t.afirmar('totales coinciden', est.totalEstudiantes === 3 && est.totalMaterias === 5 && est.aprobados === 2 && est.reprobados === 0 && est.sinNotas === 1);
t.afirmar('promedio general 3.61', est.promedioGeneral === REFERENCIA.promedioGeneral);
t.afirmar('mejor y menor promedio', est.mejor.nombre === REFERENCIA.mejor && est.menor.nombre === REFERENCIA.menor);
t.afirmar('búsqueda "ana"', EC.calculos.buscar('ana').map(x => x.nombre).join() === REFERENCIA.buscarAna.join());
t.afirmar('búsqueda "LUCIA" sin tildes', EC.calculos.buscar('LUCIA').map(x => x.nombre).join() === REFERENCIA.buscarLucia.join());

console.log('== storage.js y calculos.js dan el mismo resultado ==');
const aprueba = v => EC.configuracion.aprueba(v);
const puro = EC.calculosAcademicos.resumen(
  JSON.parse(almacen['educontrol_estudiantes']),
  JSON.parse(almacen['educontrol_calificaciones']),
  aprueba
);
t.afirmar('resumen de storage = resumen puro con los mismos datos', JSON.stringify(puro) === JSON.stringify(EC.calculos.resumen()));

console.log('== Cambio de aprobación se refleja en storage y en el módulo puro ==');
EC.auth._fijarSesion({ usuario: 'admin', rol: 'ADMIN' });
const cambio = EC.configuracion.guardar({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 4.5 });
t.afirmar('el cambio de aprobación lo hace el ADMIN', cambio.ok === true);
t.afirmar('con aprobación 4.5, Ana (4.22) pasa a REPROBADO en storage', EC.calculos.resumenDeEstudiante(1).estado_academico === 'REPROBADO');
t.afirmar('el estado sigue coherente con el promedio', EC.calculos.estadoAcademico(4.22) === 'REPROBADO');
EC.configuracion.restablecer();
EC.auth._fijarSesion(null);
t.afirmar('restablecer devuelve Ana a APROBADO', EC.calculos.resumenDeEstudiante(1).estado_academico === 'APROBADO');

t.terminar();
