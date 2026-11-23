/* tests/helpers.js - Entorno de pruebas: carga los módulos de js/ con un localStorage simulado.
   No necesita navegador ni dependencias externas. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ_JS = path.join(__dirname, '..', 'js');
const MODULOS = ['storage.js', 'configuracion.js', 'auth.js', 'respaldo.js'];

function crearEntorno() {
    const almacen = {};
    let fallarEn = null;
    const localStorage = {
        getItem: k => (k in almacen ? almacen[k] : null),
        setItem: (k, v) => { if (k === fallarEn) { throw new Error('cuota'); } almacen[k] = String(v); },
        removeItem: k => { delete almacen[k]; }
    };
    const ventana = { localStorage, sessionStorage: localStorage, EC_BASE: '' };
    ventana.window = ventana;
    const ctx = vm.createContext(ventana);
    ctx.EC = { alCargar: () => {} };
    MODULOS.forEach(f => vm.runInContext(fs.readFileSync(path.join(RAIZ_JS, f), 'utf8'), ctx, { filename: f }));
    return {
        EC: ctx.EC,
        almacen,
        fallarEn: clave => { fallarEn = clave; },
        sesion: (usuario, rol) => { almacen['educontrol_sesion'] = JSON.stringify({ usuario, rol }); },
        sinSesion: () => { delete almacen['educontrol_sesion']; }
    };
}

function copia(o) { return JSON.parse(JSON.stringify(o)); }

// Contador sencillo de pruebas. Sale con código 1 si alguna falla.
function probador() {
    let ok = 0, fallos = 0;
    return {
        afirmar(nombre, cond, detalle) {
            if (cond) { ok++; console.log('  OK  ', nombre); }
            else { fallos++; console.log('  FAIL', nombre, detalle || ''); }
        },
        terminar() {
            console.log(`Resultado: ${ok} correctas, ${fallos} fallidas`);
            process.exit(fallos ? 1 : 0);
        }
    };
}

module.exports = { crearEntorno, copia, probador };
