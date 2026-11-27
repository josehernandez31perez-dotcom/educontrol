// Pruebas de páginas protegidas y listado (modo MySQL) con el flujo de sesión del servidor (fetch simulado).
const fs = require('fs'), vm = require('vm');
const path = require('path');
const RAIZ = path.join(__dirname, '..', 'js') + path.sep;
let ok = 0, fallos = 0;
const afirmar = (n, c, d) => { if (c) { ok++; console.log('  OK  ', n); } else { fallos++; console.log('  FAIL', n, d || ''); } };
const esperar = ms => new Promise(r => setTimeout(r, ms));

const filas = [
  { id: 1, cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:00:00' },
  { id: 3, cedula: '8-300-300', nombre: 'Lucía', apellido: 'Martínez', estado: 'ACTIVO', fecha_registro: '2026-10-01 09:05:00' }
];

async function pagina({ sesion, dataRol, respuestaListado, respuestaSesion, respuestaLogout }) {
  const el = {};
  const crear = id => ({ id, value: '', textContent: '', innerHTML: '', hidden: false, dataset: {}, listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); } });
  const obtener = id => (el[id] = el[id] || crear(id));
  const body = { dataset: { seccion: 'estudiantes', rol: dataRol } };
  const nav = { href: '' };
  const llamadas = [];
  const ventana = {
    EC_BASE: '../', location: nav, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, URLSearchParams, confirm: () => true, print() {},
    fetch: async (url, opc = {}) => {
      llamadas.push(url);
      if (url.endsWith('sesion.php')) return respuestaSesion(sesion);
      if (url.endsWith('listar_estudiantes.php')) return typeof respuestaListado === 'function' ? respuestaListado() : respuestaListado;
      if (url.endsWith('logout.php')) {
        const r = respuestaLogout || { status: 200, cuerpo: { ok: true } };
        if (r.lanza) { throw new TypeError('Failed to fetch'); }
        return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.cuerpo };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };
  ventana.window = ventana;
  ventana.document = {
    getElementById: obtener, body, querySelectorAll: () => [],
    addEventListener(t, f) { if (t === 'DOMContentLoaded') f(); }
  };
  const ctx = vm.createContext(ventana);
  ctx.EC = { alCargar: () => {} };
  // Igual que la página real: fuente MySQL (estas pruebas describen el listado conectado a MySQL)
  const configFuente = fs.readFileSync(RAIZ + 'config-fuente.js', 'utf8').replace("var FUENTE_ACTUAL = 'local';", "var FUENTE_ACTUAL = 'mysql';");
  vm.runInContext(configFuente, ctx, { filename: 'config-fuente.js' });
  ['calculos.js', 'storage.js', 'configuracion.js', 'auth.js', 'layout.js', 'datos-mysql.js', 'datos.js'].forEach(f => vm.runInContext(fs.readFileSync(RAIZ + f, 'utf8'), ctx, { filename: f }));
  const mensajes = [];
  ctx.EC.mostrarMensaje = (t, x) => mensajes.push({ t, x });
  vm.runInContext(fs.readFileSync(RAIZ + 'estudiantes.js', 'utf8'), ctx, { filename: 'estudiantes.js' });
  await esperar(30);
  return { el, nav, llamadas, mensajes, ventana };
}

const sesionOk = usuario => ({ ok: true, status: 200, json: async () => ({ ok: true, usuario: usuario.usuario, rol: usuario.rol, csrf: 'c' }) });
const sinSesion = async () => ({ ok: false, status: 401, json: async () => ({ ok: false }) });
const listadoOk = async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(filas)) });
const listado401 = async () => ({ ok: false, status: 401, json: async () => ({}) });

(async () => {
  console.log('== Página protegida sin sesión ==');
  let p = await pagina({ sesion: null, dataRol: null, respuestaSesion: sinSesion, respuestaListado: listadoOk });
  afirmar('sin sesión redirige a login.html', p.nav.href === '../login.html', p.nav.href);
  afirmar('sin sesión no se pide el listado', !p.llamadas.some(u => u.endsWith('listar_estudiantes.php')));

  console.log('== Listado con sesión ADMIN ==');
  p = await pagina({ sesion: { usuario: 'admin', rol: 'ADMIN' }, dataRol: null, respuestaSesion: sesionOk, respuestaListado: listadoOk });
  afirmar('llama a sesion.php antes de mostrar la página', p.llamadas[0].endsWith('sesion.php'));
  afirmar('carga el listado desde la API', p.llamadas.some(u => u.endsWith('listar_estudiantes.php')));
  afirmar('muestra los datos de MySQL', p.el['tabla-estudiantes'].innerHTML.includes('Ana') && p.el['tabla-estudiantes'].innerHTML.includes('Lucía'));
  afirmar('ADMIN ve Editar y Eliminar', p.el['tabla-estudiantes'].innerHTML.includes('btn-eliminar'));

  console.log('== Listado con sesión CONSULTA ==');
  p = await pagina({ sesion: { usuario: 'consulta', rol: 'CONSULTA' }, dataRol: null, respuestaSesion: sesionOk, respuestaListado: listadoOk });
  afirmar('CONSULTA no ve Eliminar', !p.el['tabla-estudiantes'].innerHTML.includes('btn-eliminar'));
  afirmar('CONSULTA sí ve Ver', p.el['tabla-estudiantes'].innerHTML.includes('btn-ver'));

  console.log('== Sesión caducada durante el listado ==');
  p = await pagina({ sesion: { usuario: 'admin', rol: 'ADMIN' }, dataRol: null, respuestaSesion: sesionOk, respuestaListado: listado401 });
  afirmar('si el listado responde 401 redirige a login con aviso', p.nav.href === '../login.html?expirada=1', p.nav.href);

  console.log('== Página solo ADMIN con sesión CONSULTA ==');
  p = await pagina({ sesion: { usuario: 'consulta', rol: 'CONSULTA' }, dataRol: 'ADMIN', respuestaSesion: sesionOk, respuestaListado: listadoOk });
  afirmar('muestra acceso denegado', (p.el['contenido-pagina'].innerHTML || '').includes('No tienes permiso'));
  afirmar('no carga el listado en esa página', !p.llamadas.some(u => u.endsWith('listar_estudiantes.php')));

  console.log('== Error de red al verificar la sesión ==');
  const ventanaError = async () => { throw new TypeError('Failed to fetch'); };
  p = await pagina({ sesion: null, dataRol: null, respuestaSesion: ventanaError, respuestaListado: listadoOk });
  afirmar('error de red muestra mensaje de verificación', p.mensajes.some(m => m.t === 'error' && m.x.includes('No se pudo verificar tu sesión')));

  console.log('== Botón Cerrar sesión ==');
  async function clicCerrar(respuestaLogout) {
    const p = await pagina({ sesion: { usuario: 'admin', rol: 'ADMIN' }, dataRol: null,
      respuestaSesion: sesionOk, respuestaListado: listadoOk, respuestaLogout });
    const boton = p.el['btn-cerrar-sesion'];
    await boton.listeners.click[0]({ currentTarget: boton });
    await esperar(20);
    return { p, boton };
  }
  let r = await clicCerrar({ status: 200, cuerpo: { ok: true } });
  afirmar('servidor confirma: redirige a login con sesión cerrada', r.p.nav.href === '../login.html?salio=1', r.p.nav.href);
  afirmar('servidor confirma: no muestra error', !r.p.mensajes.some(m => m.t === 'error'));

  r = await clicCerrar({ status: 500, cuerpo: {} });
  afirmar('error HTTP: no redirige ni dice que la sesión se cerró', r.p.nav.href === '' && !r.p.nav.href.includes('salio'), r.p.nav.href);
  afirmar('error HTTP: muestra error claro', r.p.mensajes.some(m => m.t === 'error' && m.x.includes('No se pudo cerrar la sesión')));
  afirmar('error HTTP: el botón vuelve a estar activo', r.boton.disabled === false);

  r = await clicCerrar({ lanza: true });
  afirmar('red caída: no redirige ni dice que la sesión se cerró', r.p.nav.href === '');
  afirmar('red caída: muestra error claro', r.p.mensajes.some(m => m.t === 'error' && m.x.includes('No se pudo cerrar la sesión')));

  r = await clicCerrar({ status: 200, cuerpo: { ok: false } });
  afirmar('respuesta sin confirmación: no dice que la sesión se cerró', r.p.nav.href === '');

  console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
})();
