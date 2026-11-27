/* Pruebas de js/auth.js: login, sesión, cierre de sesión y token CSRF, con un fetch simulado.
   No sustituye a las pruebas en el navegador ni a las pruebas PHP. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { probador } = require('./helpers');
const t = probador();

const RUTA = path.join(__dirname, '..', 'js', 'auth.js');

// Crea un entorno con fetch simulado. `respuestas` decide qué devuelve cada endpoint.
function entorno(respuestas) {
    const llamadas = [];
    const ventana = {
        EC_BASE: '',
        crypto: undefined,
        TextEncoder,
        fetch: async (url, opciones = {}) => {
            llamadas.push({ url, metodo: opciones.method || 'GET', cabeceras: opciones.headers || {}, cuerpo: opciones.body });
            const r = respuestas[url.replace('api/', '')] || { status: 500, cuerpo: {} };
            if (r.lanza) { throw new TypeError('Failed to fetch'); }
            return {
                ok: r.status >= 200 && r.status < 300,
                status: r.status,
                json: async () => r.cuerpo
            };
        }
    };
    ventana.window = ventana;
    const ctx = vm.createContext(ventana);
    ctx.EC = {};
    vm.runInContext(fs.readFileSync(RUTA, 'utf8'), ctx, { filename: 'auth.js' });
    return { EC: ctx.EC, llamadas };
}

(async () => {
    console.log('== Sesión al cargar ==');
    let e = entorno({ 'sesion.php': { status: 401, cuerpo: {} } });
    t.afirmar('sin sesión en el servidor devuelve null', (await e.EC.auth.cargarSesion()) === null);
    t.afirmar('sin sesión, EC.auth.sesion() es null', e.EC.auth.sesion() === null);

    e = entorno({ 'sesion.php': { status: 200, cuerpo: { usuario: 'admin', rol: 'ADMIN', csrf: 'abc' } } });
    const s = await e.EC.auth.cargarSesion();
    t.afirmar('con sesión devuelve usuario y rol', s.usuario === 'admin' && s.rol === 'ADMIN');
    t.afirmar('EC.auth.sesion() queda disponible de forma síncrona', e.EC.auth.sesion().rol === 'ADMIN');

    console.log('== Inicio de sesión ==');
    e = entorno({
        'csrf.php': { status: 200, cuerpo: { ok: true, csrf: 'token-1' } },
        'login.php': { status: 200, cuerpo: { ok: true, usuario: 'admin', rol: 'ADMIN', csrf: 'token-2' } }
    });
    let correcto = await e.EC.auth.iniciarSesion('admin', 'clave-correcta');
    t.afirmar('credenciales correctas resuelven true', correcto === true);
    const login = e.llamadas.find(c => c.url.endsWith('login.php'));
    t.afirmar('el login se envía con POST', login.metodo === 'POST');
    t.afirmar('el login envía el token CSRF en la cabecera', login.cabeceras['X-CSRF-Token'] === 'token-1');
    t.afirmar('el login envía usuario y clave en JSON', JSON.parse(login.cuerpo).usuario === 'admin');
    t.afirmar('tras el login queda el rol del servidor', e.EC.auth.sesion().rol === 'ADMIN');

    e = entorno({
        'csrf.php': { status: 200, cuerpo: { ok: true, csrf: 'x' } },
        'login.php': { status: 401, cuerpo: { ok: false, mensaje: 'Usuario o contraseña incorrectos.' } }
    });
    correcto = await e.EC.auth.iniciarSesion('admin', 'mala');
    t.afirmar('contraseña incorrecta resuelve false', correcto === false);
    t.afirmar('contraseña incorrecta no crea sesión local', e.EC.auth.sesion() === null);

    e = entorno({ 'csrf.php': { status: 500, cuerpo: {} } });
    let lanzo = false;
    try { await e.EC.auth.iniciarSesion('admin', 'x'); } catch (err) { lanzo = true; }
    t.afirmar('servidor caído lanza error (no resuelve false)', lanzo);

    console.log('== Cierre de sesión ==');
    // El servidor confirma el cierre: se resuelve y se limpia la sesión local
    e = entorno({
        'csrf.php': { status: 200, cuerpo: { ok: true, csrf: 'token-9' } },
        'login.php': { status: 200, cuerpo: { ok: true, usuario: 'admin', rol: 'ADMIN', csrf: 'token-9' } },
        'logout.php': { status: 200, cuerpo: { ok: true } }
    });
    await e.EC.auth.iniciarSesion('admin', 'ok');
    const confirmado = await e.EC.auth.cerrarSesion();
    const salida = e.llamadas.find(c => c.url.endsWith('logout.php'));
    t.afirmar('el cierre se envía con POST', salida.metodo === 'POST');
    t.afirmar('el cierre envía el token CSRF', salida.cabeceras['X-CSRF-Token'] === 'token-9');
    t.afirmar('si el servidor confirma, la promesa resuelve true', confirmado === true);
    t.afirmar('tras la confirmación no queda sesión local', e.EC.auth.sesion() === null);

    // El servidor responde error HTTP: debe rechazar y conservar la sesión local
    e = entorno({ 'logout.php': { status: 500, cuerpo: {} } });
    e.EC.auth._fijarSesion({ usuario: 'admin', rol: 'ADMIN' });
    let rechazo = null;
    try { await e.EC.auth.cerrarSesion(); } catch (err) { rechazo = err; }
    t.afirmar('error HTTP en el cierre rechaza la promesa', rechazo !== null);
    t.afirmar('error HTTP conserva la sesión local', e.EC.auth.sesion() !== null);

    // La red cae durante el cierre: cerrarSesion debe rechazar y conservar la sesión local
    e = entorno({ 'logout.php': { lanza: true } });
    e.EC.auth._fijarSesion({ usuario: 'admin', rol: 'ADMIN' });
    rechazo = null;
    try { await e.EC.auth.cerrarSesion(); } catch (err) { rechazo = err; }
    t.afirmar('red caída durante el cierre rechaza la promesa', rechazo !== null);
    t.afirmar('red caída durante el cierre conserva la sesión local', e.EC.auth.sesion() !== null);

    // La respuesta llega con ok:false en el cuerpo: también debe rechazar
    e = entorno({ 'logout.php': { status: 200, cuerpo: { ok: false } } });
    e.EC.auth._fijarSesion({ usuario: 'admin', rol: 'ADMIN' });
    rechazo = null;
    try { await e.EC.auth.cerrarSesion(); } catch (err) { rechazo = err; }
    t.afirmar('respuesta sin confirmación (ok:false) rechaza', rechazo !== null);
    t.afirmar('respuesta sin confirmación conserva la sesión local', e.EC.auth.sesion() !== null);

    console.log('== Seguridad del navegador ==');
    const fuente = fs.readFileSync(RUTA, 'utf8');
    t.afirmar('auth.js ya no usa localStorage', !/localStorage/.test(fuente));
    t.afirmar('auth.js ya no calcula SHA-256 en el navegador', !/subtle|SHA-256/.test(fuente));
    t.afirmar('auth.js no contiene contraseñas', !/admin123|consulta123/.test(fuente));

    t.terminar();
})();
