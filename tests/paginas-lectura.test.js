/* Etapa D: cada pantalla de lectura se ejecuta con su código real (DOM simulado y API simulada).
   Se comprueba que en modo local y en modo MySQL se dibuja lo mismo, que las acciones de modificación
   desaparecen en modo MySQL, que las páginas de escritura quedan bloqueadas y que no se escribe en localStorage. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { probador } = require('./helpers');
const t = probador();
const JS = path.join(__dirname, '..', 'js');
const esperar = ms => new Promise(r => setTimeout(r, ms));

// Datos en la forma de los endpoints PHP (números y fechas como texto)
const API = {
  'listar_estudiantes.php': [
    { id: '1', cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:00:00' },
    { id: '3', cedula: '8-300-300', nombre: 'Lucía', apellido: 'Martínez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:05:00' },
    { id: '4', cedula: '8-400-400', nombre: 'Miguel', apellido: 'Rojas', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:10:00' }
  ],
  'listar_materias.php': [
    { id: '1', nombre: 'Matemáticas', estado: 'ACTIVA' }, { id: '2', nombre: 'Español', estado: 'ACTIVA' },
    { id: '3', nombre: 'Ciencias Naturales', estado: 'ACTIVA' }, { id: '4', nombre: 'Ciencias Sociales', estado: 'ACTIVA' },
    { id: '5', nombre: 'Inglés', estado: 'ACTIVA' }
  ],
  'listar_calificaciones.php': [
    ['1', 1, 1, '4.5'], ['2', 1, 2, '4.0'], ['3', 1, 3, '3.8'], ['4', 1, 4, '4.2'], ['5', 1, 5, '4.6'],
    ['6', 3, 1, '3.0'], ['7', 3, 2, '3.0'], ['8', 3, 3, '3.0'], ['9', 3, 4, '3.0'], ['10', 3, 5, '3.0']
  ].map(([id, est, mat, nota]) => {
    const nombres = { 1: ['Ana', 'Pérez', '8-100-100'], 3: ['Lucía', 'Martínez', '8-300-300'] };
    const materias = ['Matemáticas', 'Español', 'Ciencias Naturales', 'Ciencias Sociales', 'Inglés'];
    const [nom, ape, ced] = nombres[est];
    return { id, estudiante: nom, apellido: ape, materia: materias[mat - 1], nota,
      fecha_registro: est === 1 ? '2026-10-01 10:00:00' : '2026-10-01 10:05:00',
      estudiante_id: String(est), materia_id: String(mat), cedula: ced, nombre: nom };
  })
};

function elemento(id) {
  return {
    id, value: '', textContent: '', dataset: {}, listeners: {}, _html: '', firstChild: null,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.firstChild = { textContent: '' }; },
    addEventListener(tipo, f) { (this.listeners[tipo] = this.listeners[tipo] || []).push(f); },
    disparar(tipo, evento) { (this.listeners[tipo] || []).forEach(f => f(evento)); }
  };
}

// Carga una página: scripts comunes + script de la página, en el orden que usa su HTML
async function cargar({ fuente, script, base = '', atributos = {}, rolSesion = 'ADMIN', query = '', api = null, espera = 60 }) {
  const el = {};
  const obtener = id => (el[id] = el[id] || elemento(id));
  const almacen = {};
  const llamadas = [];
  const nav = { href: '', search: query };
  const body = { dataset: Object.assign({ seccion: 'x' }, atributos) };

  const respuesta = async url => {
    if (url.endsWith('sesion.php')) {
      return { status: 200, cuerpo: { ok: true, usuario: 'admin', rol: rolSesion, csrf: 'c' } };
    }
    const nombre = Object.keys(API).find(n => url.endsWith(n));
    if (api) { const r = await api(url); if (r) { return r; } }
    return nombre ? { status: 200, cuerpo: API[nombre] } : { status: 404, cuerpo: {} };
  };

  const ventana = {
    EC_BASE: base, location: nav, URLSearchParams, confirm: () => true, print() {},
    localStorage: {
      getItem: k => (k in almacen ? almacen[k] : null),
      setItem: (k, v) => { almacen[k] = String(v); },
      removeItem: k => { delete almacen[k]; }
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (url, init = {}) => {
      llamadas.push({ url, metodo: init.method || 'GET' });
      const r = await respuesta(url);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => JSON.parse(JSON.stringify(r.cuerpo)) };
    }
  };
  ventana.window = ventana;
  ventana.document = {
    getElementById: obtener, body, querySelectorAll: () => [],
    addEventListener(tipo, f) { if (tipo === 'DOMContentLoaded') { f(); } }
  };

  const ctx = vm.createContext(ventana);
  let config = fs.readFileSync(path.join(JS, 'config-fuente.js'), 'utf8');
  if (fuente === 'mysql') { config = config.replace("var FUENTE_ACTUAL = 'local';", "var FUENTE_ACTUAL = 'mysql';"); }
  vm.runInContext(config, ctx, { filename: 'config-fuente.js' });
  ['calculos.js', 'storage.js', 'configuracion.js', 'auth.js', 'layout.js', 'datos-mysql.js', 'datos.js', script]
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f }));

  await esperar(espera);
  return { el, almacen, llamadas, nav };
}

// Contenido visible de la página, sin el aviso de modo (que solo existe en MySQL) ni la fecha de generación
function salida(p) {
  return Object.keys(p.el).filter(k => k !== 'mensajes' && k !== 'sidebar' && p.el[k].innerHTML)
    .sort().map(k => k + '=' + p.el[k].innerHTML.replace(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/g, 'FECHA')).join('\n');
}

const paginas = [
  { nombre: 'dashboard', script: 'dashboard.js' },
  { nombre: 'estadísticas', script: 'estadisticas.js' },
  { nombre: 'reportes: menú', script: 'reportes.js', base: '../', atributos: { pagina: 'index' } },
  { nombre: 'reportes: individual', script: 'reportes.js', base: '../', atributos: { pagina: 'individual' }, query: '?id=1' },
  { nombre: 'reportes: general', script: 'reportes.js', base: '../', atributos: { pagina: 'general' } },
  { nombre: 'detalle de estudiante', script: 'estudiantes-detalle.js', base: '../', query: '?id=1', rolSesion: 'CONSULTA' },
  { nombre: 'calificaciones (rol CONSULTA)', script: 'calificaciones.js', base: '../', query: '?estudiante_id=3', rolSesion: 'CONSULTA' }
];

(async () => {
  console.log('== Modo local y modo MySQL dibujan lo mismo ==');
  for (const p of paginas) {
    const local = await cargar({ fuente: 'local', ...p });
    const mysql = await cargar({ fuente: 'mysql', ...p });
    t.afirmar(p.nombre + ': mismo contenido en ambos modos', salida(local) === salida(mysql) && salida(local).length > 0,
      salida(local).slice(0, 80) + ' ≠ ' + salida(mysql).slice(0, 80));
  }

  console.log('== Buscador de estadísticas con los mismos resultados ==');
  const buscarEn = async fuente => {
    const p = await cargar({ fuente, script: 'estadisticas.js' });
    const buscador = p.el['buscador-estadisticas'];
    buscador.value = 'lucia';
    buscador.disparar('input', {});
    await esperar(30);
    return p.el['resultado-busqueda'].innerHTML;
  };
  const busquedaLocal = await buscarEn('local');
  const busquedaMysql = await buscarEn('mysql');
  t.afirmar('la búsqueda devuelve a Lucía en ambos modos', /Lucía/.test(busquedaLocal) && busquedaLocal === busquedaMysql);

  console.log('== Modo MySQL: aviso y sin acciones de modificación ==');
  const pMysql = await cargar({ fuente: 'mysql', script: 'dashboard.js' });
  t.afirmar('en modo MySQL aparece el aviso de solo lectura', /Modo MySQL \(solo lectura\)/.test(pMysql.el['mensajes'].firstChild.textContent));
  const pLocal = await cargar({ fuente: 'local', script: 'dashboard.js' });
  t.afirmar('en modo local no aparece el aviso de MySQL', !pLocal.el['mensajes'] || pLocal.el['mensajes'].firstChild === null);

  const detMysql = await cargar({ fuente: 'mysql', script: 'estudiantes-detalle.js', base: '../', query: '?id=1', rolSesion: 'ADMIN' });
  const detLocal = await cargar({ fuente: 'local', script: 'estudiantes-detalle.js', base: '../', query: '?id=1', rolSesion: 'ADMIN' });
  t.afirmar('detalle (ADMIN) en local ofrece Editar', /editar\.html\?id=1/.test(detLocal.el['contenido-pagina'].innerHTML));
  t.afirmar('detalle (ADMIN) en MySQL no ofrece Editar', !/editar\.html/.test(detMysql.el['contenido-pagina'].innerHTML));

  const calMysql = await cargar({ fuente: 'mysql', script: 'calificaciones.js', base: '../', rolSesion: 'ADMIN' });
  const calLocal = await cargar({ fuente: 'local', script: 'calificaciones.js', base: '../', rolSesion: 'ADMIN' });
  t.afirmar('calificaciones (ADMIN) en local muestra Eliminar', /btn-eliminar/.test(calLocal.el['tabla-calificaciones'].innerHTML));
  t.afirmar('calificaciones (ADMIN) en MySQL no muestra Eliminar ni Editar',
    !/btn-eliminar|editar\.html/.test(calMysql.el['tabla-calificaciones'].innerHTML));
  t.afirmar('calificaciones en MySQL muestra las 10 filas', calMysql.el['contador'].textContent === 'Calificaciones registradas: 10', calMysql.el['contador'].textContent);

  console.log('== Páginas de escritura bloqueadas en modo MySQL ==');
  const escrituras = [
    { nombre: 'registrar estudiante', script: 'estudiantes-form.js', base: '../', atributos: { escritura: 'true', rol: 'ADMIN', modo: 'registrar' } },
    { nombre: 'editar calificación', script: 'calificaciones-form.js', base: '../', atributos: { escritura: 'true', rol: 'ADMIN', modo: 'editar' }, query: '?id=1' },
    { nombre: 'configuración', script: 'configuracion-form.js', base: '../', atributos: { escritura: 'true', rol: 'ADMIN' } },
    { nombre: 'respaldo', script: 'respaldo.js', base: '../', atributos: { escritura: 'true', rol: 'ADMIN' } }
  ];
  for (const e of escrituras) {
    const p = await cargar({ fuente: 'mysql', ...e });
    const html = p.el['contenido-pagina'].innerHTML;
    t.afirmar(e.nombre + ': en MySQL muestra el aviso y no se ejecuta', /deshabilitadas en el modo MySQL/.test(html) && html.indexOf('<form') === -1);
    t.afirmar(e.nombre + ': en MySQL no escribe en localStorage', Object.keys(p.almacen).length === 0, Object.keys(p.almacen).join());
  }

  console.log('== Modo MySQL no siembra datos de demostración ni escribe en localStorage ==');
  const almacenMysql = (await cargar({ fuente: 'mysql', script: 'dashboard.js' })).almacen;
  t.afirmar('en modo MySQL no se crea ninguna clave de localStorage', Object.keys(almacenMysql).length === 0, Object.keys(almacenMysql).join());
  const almacenLocal = (await cargar({ fuente: 'local', script: 'dashboard.js' })).almacen;
  t.afirmar('en modo local la siembra sigue creando sus claves', almacenLocal['educontrol_version_datos'] === '1');

  console.log('== Solo lectura en modo MySQL ==');
  const sesMysql = await cargar({ fuente: 'mysql', script: 'calificaciones.js', base: '../', rolSesion: 'ADMIN' });
  t.afirmar('en MySQL solo se hacen peticiones GET', sesMysql.llamadas.every(l => l.metodo === 'GET'));
  t.afirmar('en MySQL no se llama a ningún endpoint de escritura',
    sesMysql.llamadas.every(l => !/logout|crear|actualizar|eliminar|registrar|guardar|importar/.test(l.url)),
    sesMysql.llamadas.map(l => l.url).join());

  console.log('== Error de carga con Reintentar ==');
  let fallos = 1;
  const conFallo = await cargar({ fuente: 'mysql', script: 'dashboard.js', api: url => {
    if (url.endsWith('listar_estudiantes.php') && fallos > 0) { fallos--; return { status: 500, cuerpo: {} }; }
    return null;
  } });
  const htmlError = conFallo.el['contenido-pagina'].innerHTML;
  t.afirmar('un error de carga muestra el mensaje y el botón Reintentar',
    /alerta-error/.test(htmlError) && /btn-reintentar/.test(htmlError) && /No se pudo conectar/.test(htmlError));
  conFallo.el['contenido-pagina'].disparar('click', { target: { id: 'btn-reintentar' } });
  await esperar(60);
  t.afirmar('Reintentar vuelve a cargar y dibuja el dashboard', /Total de estudiantes/.test(conFallo.el['contenido-pagina'].innerHTML));

  console.log('== Sesión caducada en una página de lectura ==');
  const caducada = await cargar({ fuente: 'mysql', script: 'dashboard.js', api: url =>
    url.endsWith('listar_estudiantes.php') ? { status: 401, cuerpo: {} } : null });
  t.afirmar('una sesión caducada redirige al login', caducada.nav.href === 'login.html?expirada=1', caducada.nav.href);
  t.afirmar('una sesión caducada no muestra error en la página', !/alerta-error/.test(caducada.el['contenido-pagina'].innerHTML));

  console.log('== Modificación local conserva su comportamiento ==');
  const borrado = await cargar({ fuente: 'local', script: 'calificaciones.js', base: '../', rolSesion: 'ADMIN' });
  const antes = borrado.el['contador'].textContent;
  const boton = { dataset: { id: '1', texto: 'Matemáticas de Ana Pérez' }, closest: () => null };
  borrado.el['tabla-calificaciones'].disparar('click', { target: { closest: sel => (sel === '.btn-eliminar' ? boton : null) } });
  await esperar(60);
  t.afirmar('en local, eliminar una calificación actualiza el listado', antes === 'Calificaciones registradas: 10' &&
    borrado.el['contador'].textContent === 'Calificaciones registradas: 9', borrado.el['contador'].textContent);

  console.log('== Listado de estudiantes: mismo contenido en ambos modos ==');
  for (const rol of ['ADMIN', 'CONSULTA']) {
    const l = await cargar({ fuente: 'local', script: 'estudiantes.js', rolSesion: rol });
    const m = await cargar({ fuente: 'mysql', script: 'estudiantes.js', rolSesion: rol });
    t.afirmar('listado (' + rol + '): mismo contenido en ambos modos', salida(l) === salida(m) && /Ana/.test(salida(m)) && /Lucía/.test(salida(m)),
      salida(l).slice(0, 80) + ' ≠ ' + salida(m).slice(0, 80));
  }

  console.log('== Listado: cada modo lee de su fuente ==');
  const soloMiguel = url => url.endsWith('listar_estudiantes.php')
    ? { status: 200, cuerpo: [{ id: '4', cedula: '8-400-400', nombre: 'Miguel', apellido: 'Rojas', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:10:00' }] }
    : null;
  const listadoLocal = await cargar({ fuente: 'local', script: 'estudiantes.js', api: soloMiguel });
  t.afirmar('en modo local muestra los 3 estudiantes de localStorage (no la API)', listadoLocal.el['contador'].textContent === 'Estudiantes registrados: 3', listadoLocal.el['contador'].textContent);
  t.afirmar('en modo local no pide el listado a la API', !listadoLocal.llamadas.some(l => l.url.endsWith('listar_estudiantes.php')));
  const listadoMysql = await cargar({ fuente: 'mysql', script: 'estudiantes.js', api: soloMiguel });
  t.afirmar('en modo MySQL muestra lo que devuelve la API (1 estudiante)', listadoMysql.el['contador'].textContent === 'Estudiantes registrados: 1', listadoMysql.el['contador'].textContent);
  t.afirmar('en modo MySQL el listado hace una sola petición', listadoMysql.llamadas.filter(l => l.url.endsWith('listar_estudiantes.php')).length === 1);
  t.afirmar('en modo MySQL no se escribe en localStorage', Object.keys(listadoMysql.almacen).length === 0, Object.keys(listadoMysql.almacen).join());

  console.log('== Listado: búsqueda con los mismos resultados ==');
  for (const fuente of ['local', 'mysql']) {
    const p = await cargar({ fuente, script: 'estudiantes.js' });
    p.el['buscador'].value = 'lucia';
    p.el['buscador'].disparar('input', {});
    t.afirmar('búsqueda "lucia" en ' + fuente + ': 1 resultado', p.el['contador'].textContent === 'Estudiantes registrados: 1 (búsqueda)', p.el['contador'].textContent);
  }

  console.log('== Listado: Ver/Editar/Eliminar siguen sin ejecutar acciones ==');
  const clicVer = { target: { closest: sel => (sel === '.btn-ver' ? {} : null) } };
  const pLocalVer = await cargar({ fuente: 'local', script: 'estudiantes.js' });
  const antesLocal = JSON.stringify(pLocalVer.almacen);
  pLocalVer.el['tabla-estudiantes'].disparar('click', clicVer);
  t.afirmar('en local, Ver muestra el aviso sin hablar de MySQL', /disponible en el listado/.test(pLocalVer.el['mensajes'].firstChild.textContent), pLocalVer.el['mensajes'].firstChild.textContent);
  t.afirmar('en local, Ver no modifica localStorage', JSON.stringify(pLocalVer.almacen) === antesLocal);
  const pMysqlVer = await cargar({ fuente: 'mysql', script: 'estudiantes.js' });
  pMysqlVer.el['tabla-estudiantes'].disparar('click', clicVer);
  t.afirmar('en MySQL, Ver muestra el aviso de conexión pendiente', /conectada a MySQL/.test(pMysqlVer.el['mensajes'].firstChild.textContent));
  t.afirmar('en MySQL, Ver no envía ninguna escritura', pMysqlVer.llamadas.every(l => l.metodo === 'GET'));

  console.log('== Listado en MySQL: error, Reintentar, sesión caducada y carga ==');
  let fallosListado = 1;
  const conError = await cargar({ fuente: 'mysql', script: 'estudiantes.js', api: url =>
    url.endsWith('listar_estudiantes.php') && fallosListado-- > 0 ? { status: 500, cuerpo: {} } : null });
  const zonaError = conError.el['tabla-estudiantes'].innerHTML;
  t.afirmar('un error de carga muestra el mensaje y Reintentar', /alerta-error/.test(zonaError) && /btn-reintentar/.test(zonaError) && /No se pudo conectar/.test(zonaError));
  t.afirmar('un error de carga marca el contador como no disponible', conError.el['contador'].textContent === 'Estudiantes registrados: no disponible', conError.el['contador'].textContent);
  conError.el['tabla-estudiantes'].disparar('click', { target: { closest: sel => (sel === '#btn-reintentar' ? {} : null) } });
  await esperar(60);
  t.afirmar('Reintentar vuelve a cargar el listado', /Ana/.test(conError.el['tabla-estudiantes'].innerHTML) && conError.el['contador'].textContent === 'Estudiantes registrados: 3', conError.el['contador'].textContent);

  const caducado = await cargar({ fuente: 'mysql', script: 'estudiantes.js', api: url =>
    url.endsWith('listar_estudiantes.php') ? { status: 401, cuerpo: {} } : null });
  t.afirmar('en MySQL, una sesión caducada redirige al login con aviso', caducado.nav.href === 'login.html?expirada=1', caducado.nav.href);
  t.afirmar('en MySQL, una sesión caducada no muestra error en el listado', !/alerta-error/.test(caducado.el['tabla-estudiantes'].innerHTML));

  const lento = await cargar({ fuente: 'mysql', script: 'estudiantes.js', espera: 20, api: async url => {
    if (url.endsWith('listar_estudiantes.php')) { await esperar(150); }
    return null;
  } });
  t.afirmar('mientras carga, muestra «Cargando estudiantes…»', /Cargando estudiantes…/.test(lento.el['tabla-estudiantes'].innerHTML));
  await esperar(250);
  t.afirmar('al terminar, muestra el listado', /Lucía/.test(lento.el['tabla-estudiantes'].innerHTML));

  console.log('== Listado en MySQL: el texto de error cita la conexión ==');
  // En local no hay un error de carga alcanzable: leer() de storage.js ya devuelve lista vacía ante datos inválidos
  const errorMysqlTexto = await cargar({ fuente: 'mysql', script: 'estudiantes.js', api: url =>
    url.endsWith('listar_estudiantes.php') ? { status: 500, cuerpo: {} } : null });
  t.afirmar('en MySQL el texto de error sigue citando la conexión a la base de datos', /base de datos/.test(errorMysqlTexto.el['tabla-estudiantes'].innerHTML));

  t.terminar();
})();
