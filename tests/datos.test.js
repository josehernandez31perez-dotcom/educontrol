/* Pruebas de js/datos.js: la fuente local devuelve los mismos resultados que las funciones actuales,
   y la fuente mysql (todavía no activada) rechaza con un mensaje claro sin llamar a la red. */
const { crearEntorno, probador } = require('./helpers');
const t = probador();
const { EC } = crearEntorno();
const ACCESO = EC.datos;

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const esPromesa = p => p && typeof p.then === 'function';

(async () => {
  console.log('== Forma de la capa de datos ==');
  t.afirmar('EC.datos existe y declara la fuente local', ACCESO.fuente === 'local');
  t.afirmar('EC.datos está congelado (no se pueden añadir ni cambiar operaciones)', Object.isFrozen(ACCESO));
  t.afirmar('todas las operaciones son funciones', ['estudiantes', 'materias', 'calificacionesDetalle', 'resumen', 'estadisticas', 'buscar', 'resumenDeEstudiante', 'notasDeEstudiante', 'promedioDeEstudiante', 'configuracion', 'estudiantePorId'].every(n => typeof ACCESO[n] === 'function'));
  t.afirmar('las operaciones devuelven promesas', esPromesa(ACCESO.estudiantes()));

  console.log('== Fuente local: mismos resultados que las funciones actuales ==');
  t.afirmar('estudiantes = EC.estudiantes.listar()', iguales(await ACCESO.estudiantes(), EC.estudiantes.listar()));
  t.afirmar('materias = EC.materias.listar()', iguales(await ACCESO.materias(), EC.materias.listar()));
  t.afirmar('calificacionesDetalle = EC.calificaciones.listarDetalle()', iguales(await ACCESO.calificacionesDetalle(), EC.calificaciones.listarDetalle()));
  t.afirmar('resumen = EC.calculos.resumen()', iguales(await ACCESO.resumen(), EC.calculos.resumen()));
  t.afirmar('estadisticas = EC.calculos.estadisticas()', iguales(await ACCESO.estadisticas(), EC.calculos.estadisticas()));
  t.afirmar('buscar("lucia") = EC.calculos.buscar("lucia")', iguales(await ACCESO.buscar('lucia'), EC.calculos.buscar('lucia')));
  t.afirmar('resumenDeEstudiante(1) = EC.calculos.resumenDeEstudiante(1)', iguales(await ACCESO.resumenDeEstudiante(1), EC.calculos.resumenDeEstudiante(1)));
  t.afirmar('notasDeEstudiante(3) = EC.calculos.notasDeEstudiante(3)', iguales(await ACCESO.notasDeEstudiante(3), EC.calculos.notasDeEstudiante(3)));
  t.afirmar('promedioDeEstudiante(1) = EC.calculos.promedioDeEstudiante(1)', (await ACCESO.promedioDeEstudiante(1)) === EC.calculos.promedioDeEstudiante(1));
  t.afirmar('estudiantePorId(4) = EC.estudiantes.obtener(4)', iguales(await ACCESO.estudiantePorId(4), EC.estudiantes.obtener(4)));
  t.afirmar('configuracion = EC.configuracion.obtener()', iguales(await ACCESO.configuracion(), EC.configuracion.obtener()));

  console.log('== Valores de demostración (referencia) ==');
  const r = await ACCESO.resumen();
  t.afirmar('Ana 4.22 APROBADO a través de la capa', r[0].nombre === 'Ana' && r[0].promedio === 4.22 && r[0].estado_academico === 'APROBADO');
  t.afirmar('Lucía 3.00 APROBADO a través de la capa', r[1].nombre === 'Lucía' && r[1].promedio === 3 && r[1].estado_academico === 'APROBADO');
  t.afirmar('Miguel SIN NOTAS a través de la capa', r[2].nombre === 'Miguel' && r[2].estado_academico === 'SIN NOTAS');
  const est = await ACCESO.estadisticas();
  t.afirmar('promedio general 3.61 a través de la capa', est.promedioGeneral === 3.61);

  console.log('== Compatibilidad: las funciones actuales siguen siendo síncronas ==');
  t.afirmar('EC.estudiantes.listar() sigue devolviendo un array (no promesa)', Array.isArray(EC.estudiantes.listar()));
  t.afirmar('EC.calculos.resumen() sigue devolviendo un array (no promesa)', Array.isArray(EC.calculos.resumen()));

  console.log('== Errores de la capa local se convierten en rechazos ==');
  const fallo = EC.crearAccesoDatos('local', null);
  const original = EC.calculos.resumen;
  EC.calculos.resumen = () => { throw new Error('fallo simulado'); };
  let rechazo = null;
  try { await fallo.resumen(); } catch (e) { rechazo = e; }
  EC.calculos.resumen = original;
  t.afirmar('un error síncrono se entrega como rechazo de la promesa', rechazo !== null && rechazo.message === 'fallo simulado');

  console.log('== Fabricación de accesos ==');
  let lanzo = false;
  try { EC.crearAccesoDatos('desconocida', null); } catch (e) { lanzo = /no válida/.test(e.message); }
  t.afirmar('una fuente desconocida se rechaza al crear el acceso', lanzo);

  console.log('== Fuente mysql: no activada, rechaza sin llamar a la red ==');
  let llamadasRed = 0;
  const redOriginal = global.fetch;
  global.fetch = () => { llamadasRed++; return Promise.resolve({ ok: true, json: async () => [] }); };
  const mysql = EC.crearAccesoDatos('mysql', null);
  let mensaje = null;
  try { await mysql.estudiantes(); } catch (e) { mensaje = e.message; }
  global.fetch = redOriginal;
  t.afirmar('sin adaptador remoto, mysql rechaza con mensaje claro', mensaje === 'La fuente MySQL todavía no está activada en esta versión.', mensaje);
  t.afirmar('mysql no realiza ninguna petición de red', llamadasRed === 0);
  t.afirmar('todas las operaciones de mysql rechazan', await Promise.all(['materias', 'resumen', 'configuracion'].map(n => mysql[n]().then(() => false, () => true))).then(a => a.every(Boolean)));

  console.log('== Fabricación con adaptador remoto (preparación para etapas posteriores) ==');
  const remotoIncompleto = { estudiantes: () => Promise.resolve([]) };
  let incompleto = false;
  try { EC.crearAccesoDatos('mysql', remotoIncompleto); } catch (e) { incompleto = /no implementa/.test(e.message); }
  t.afirmar('un adaptador remoto incompleto se rechaza al crear', incompleto);

  const simulado = {};
  ['estudiantes','estudiantePorId','materias','calificacionesDetalle','resumen','estadisticas','buscar','resumenDeEstudiante','notasDeEstudiante','promedioDeEstudiante','configuracion'].forEach(n => simulado[n] = () => Promise.resolve('remoto:' + n));
  const conRemoto = EC.crearAccesoDatos('mysql', simulado);
  t.afirmar('con adaptador remoto completo, las operaciones usan el remoto', (await conRemoto.materias()) === 'remoto:materias');
  t.afirmar('el acceso remoto declara la fuente mysql', conRemoto.fuente === 'mysql');
  t.afirmar('el acceso local no cambia al crear otro acceso', (await ACCESO.materias()).length === EC.materias.listar().length);

  t.terminar();
})();
