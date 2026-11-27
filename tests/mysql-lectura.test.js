/* Etapa D: el adaptador MySQL de solo lectura devuelve lo mismo que la versión local con los mismos datos,
   convierte los tipos que MySQL entrega como texto y no realiza ninguna escritura. Fetch simulado. */
const { crearEntorno, probador } = require('./helpers');
const t = probador();

// Mismos datos que la siembra de demostración, en la forma que devuelven los endpoints PHP (números como texto)
const ESTUDIANTES = [
  { id: '1', cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:00:00' },
  { id: '3', cedula: '8-300-300', nombre: 'Lucía', apellido: 'Martínez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:05:00' },
  { id: '4', cedula: '8-400-400', nombre: 'Miguel', apellido: 'Rojas', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:10:00' }
];
const MATERIAS = [
  { id: '1', nombre: 'Matemáticas', estado: 'ACTIVA' }, { id: '2', nombre: 'Español', estado: 'ACTIVA' },
  { id: '3', nombre: 'Ciencias Naturales', estado: 'ACTIVA' }, { id: '4', nombre: 'Ciencias Sociales', estado: 'ACTIVA' },
  { id: '5', nombre: 'Inglés', estado: 'ACTIVA' }
];
const NOTAS = [
  [1, 1, 1, '4.5'], [2, 1, 2, '4.0'], [3, 1, 3, '3.8'], [4, 1, 4, '4.2'], [5, 1, 5, '4.6'],
  [6, 3, 1, '3.0'], [7, 3, 2, '3.0'], [8, 3, 3, '3.0'], [9, 3, 4, '3.0'], [10, 3, 5, '3.0']
];
const CALIFICACIONES = NOTAS.map(([id, est, mat, nota]) => {
  const e = ESTUDIANTES.find(x => x.id === String(est));
  const m = MATERIAS.find(x => x.id === String(mat));
  return { id: String(id), estudiante: e.nombre, apellido: e.apellido, materia: m.nombre, nota,
    fecha_registro: est === 1 ? '2026-10-01 10:00:00' : '2026-10-01 10:05:00', estudiante_id: String(est), materia_id: String(mat),
    cedula: e.cedula, nombre: e.nombre };
});

function fetchSimulado(respuesta) {
  const llamadas = [];
  const fetch = async (url, init = {}) => {
    llamadas.push({ url, metodo: init.method || 'GET' });
    const r = respuesta ? respuesta(url) : null;
    if (r) { return r; }
    const datos = url.endsWith('listar_estudiantes.php') ? ESTUDIANTES
      : url.endsWith('listar_materias.php') ? MATERIAS
      : url.endsWith('listar_calificaciones.php') ? CALIFICACIONES : null;
    if (!datos) { return { ok: false, status: 404, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(datos)) };
  };
  return { fetch, llamadas };
}

(async () => {
  const { EC } = crearEntorno();
  const sinCaducar = { caducadas: 0 };
  const sim = fetchSimulado();
  const mysql = EC.crearAdaptadorMysql({ fetch: sim.fetch, base: '', alCaducarSesion: () => { sinCaducar.caducadas++; } });
  const local = EC.datos;

  console.log('== Equivalencia: mismos resultados que la versión local ==');
  const operaciones = [
    ['estudiantes', []], ['materias', []], ['calificacionesDetalle', []], ['resumen', []], ['estadisticas', []],
    ['buscar', ['lucia']], ['buscar', ['']], ['resumenDeEstudiante', [1]], ['notasDeEstudiante', [3]],
    ['promedioDeEstudiante', [4]], ['estudiantePorId', [3]], ['configuracion', []]
  ];
  for (const [nombre, args] of operaciones) {
    const a = JSON.stringify(await local[nombre](...args));
    const b = JSON.stringify(await mysql[nombre](...args));
    t.afirmar(nombre + '(' + args.join(',') + ') igual que la versión local', a === b, a.slice(0, 120) + ' / ' + b.slice(0, 120));
  }

  console.log('== Cifras de referencia desde MySQL ==');
  const resumen = await mysql.resumen();
  const pr = Object.fromEntries(resumen.map(r => [r.nombre, r.promedio]));
  t.afirmar('Ana tiene promedio 4.22', pr['Ana'] === 4.22, pr['Ana']);
  t.afirmar('Lucía tiene promedio 3.00', pr['Lucía'] === 3, pr['Lucía']);
  t.afirmar('Miguel no tiene notas (promedio null)', pr['Miguel'] === null, pr['Miguel']);
  const est = await mysql.estadisticas();
  t.afirmar('3 estudiantes y 5 materias', est.totalEstudiantes === 3 && est.totalMaterias === 5);
  t.afirmar('2 aprobados, 0 reprobados, 1 sin notas', est.aprobados === 2 && est.reprobados === 0 && est.sinNotas === 1);
  t.afirmar('promedio general 3.61', est.promedioGeneral === 3.61, est.promedioGeneral);

  console.log('== Tipos convertidos (MySQL devuelve texto) ==');
  const ests = await mysql.estudiantes();
  t.afirmar('los ids de estudiantes son números', ests.every(e => typeof e.id === 'number'));
  const dets = await mysql.calificacionesDetalle();
  t.afirmar('notas y ids de calificaciones son números', dets.every(c => typeof c.nota === 'number' && typeof c.estudiante_id === 'number' && typeof c.materia_id === 'number'));
  const ana = ests.find(e => e.id === 1);
  t.afirmar('fechas en formato ISO (con T)', ana.fecha_registro === '2026-10-01T09:00:00', ana.fecha_registro);

  console.log('== Solo lectura y caché de una sola carga ==');
  const cuenta = fetchSimulado();
  const lector = EC.crearAdaptadorMysql({ fetch: cuenta.fetch, base: '', alCaducarSesion: () => {} });
  await lector.estadisticas();
  const usados = cuenta.llamadas.map(l => l.url.split('/').pop());
  t.afirmar('la primera lectura pide los tres listados', usados.join() === 'listar_estudiantes.php,listar_materias.php,listar_calificaciones.php', usados.join());
  await lector.buscar('a'); await lector.resumen(); await lector.promedioDeEstudiante(1);
  t.afirmar('las lecturas siguientes reutilizan la misma instantánea', cuenta.llamadas.length === 3, cuenta.llamadas.length);
  await lector.estudiantes();
  t.afirmar('la lista de estudiantes hace una sola petición', cuenta.llamadas.length === 4 && cuenta.llamadas[3].url.endsWith('listar_estudiantes.php'), cuenta.llamadas.length);
  t.afirmar('todas las peticiones son GET', cuenta.llamadas.every(l => l.metodo === 'GET') && sim.llamadas.every(l => l.metodo === 'GET'));

  console.log('== Errores ==');
  const sesion = fetchSimulado(url => url.endsWith('listar_estudiantes.php') ? { ok: false, status: 401, json: async () => ({}) } : null);
  let caducada = null;
  const conCaducidad = EC.crearAdaptadorMysql({ fetch: sesion.fetch, base: '', alCaducarSesion: () => { sinCaducar.caducadas++; } });
  try { await conCaducidad.estudiantes(); } catch (e) { caducada = e; }
  t.afirmar('401 se rechaza marcado como sesión caducada', caducada && caducada.sesionCaducada === true);
  t.afirmar('401 llama a la redirección de sesión una vez', sinCaducar.caducadas === 1, sinCaducar.caducadas);

  let red = null;
  const sinRed = EC.crearAdaptadorMysql({ fetch: async () => { throw new TypeError('Failed to fetch'); }, base: '' });
  try { await sinRed.materias(); } catch (e) { red = e; }
  t.afirmar('un fallo de red tiene mensaje para el usuario', red && /MySQL/.test(red.mensajeUsuario || ''), red && red.mensajeUsuario);

  let noArray = null;
  const respuestaRara = EC.crearAdaptadorMysql({ fetch: async () => ({ ok: true, status: 200, json: async () => ({ error: 'x' }) }), base: '' });
  try { await respuestaRara.materias(); } catch (e) { noArray = e; }
  t.afirmar('una respuesta que no es lista se rechaza', noArray && !!noArray.mensajeUsuario);

  let http500 = null;
  const error500 = EC.crearAdaptadorMysql({ fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }), base: '' });
  try { await error500.estadisticas(); } catch (e) { http500 = e; }
  t.afirmar('un error HTTP 500 se rechaza con mensaje', http500 && !!http500.mensajeUsuario);

  console.log('== Recuperación tras un fallo ==');
  let intentos = 0;
  const recupera = EC.crearAdaptadorMysql({ fetch: async (url) => {
    intentos++;
    if (intentos <= 1) { return { ok: false, status: 500, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(url.endsWith('listar_estudiantes.php') ? ESTUDIANTES : url.endsWith('listar_materias.php') ? MATERIAS : CALIFICACIONES)) };
  }, base: '' });
  try { await recupera.estudiantes(); } catch (e) { /* primer fallo esperado */ }
  const trasFallo = await recupera.estudiantes().then(() => true, () => false);
  t.afirmar('tras un fallo, la siguiente operación vuelve a pedir los datos', trasFallo);

  console.log('== Adaptador vacío y acceso congelado ==');
  const vacio = EC.crearAdaptadorMysql({ fetch: async () => ({ ok: true, status: 200, json: async () => [] }), base: '' });
  const v = await vacio.estadisticas();
  t.afirmar('sin datos: 0 estudiantes y promedio general null', v.totalEstudiantes === 0 && v.promedioGeneral === null);
  t.afirmar('sin estudiante, estudiantePorId devuelve null', (await vacio.estudiantePorId(9)) === null);
  const acceso = EC.crearAccesoDatos('mysql', mysql);
  t.afirmar('el acceso mysql con este adaptador tiene fuente mysql', acceso.fuente === 'mysql');
  t.afirmar('el acceso mysql devuelve los mismos datos', JSON.stringify(await acceso.materias()) === JSON.stringify(await local.materias()));
  t.afirmar('la fuente de EC.datos sigue siendo local', EC.datos.fuente === 'local' && EC.fuente === 'local');

  t.terminar();
})();
