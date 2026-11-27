/* Pruebas de EC.fuente: definida en código, de solo lectura y por defecto 'local'. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { crearEntorno, probador } = require('./helpers');
const t = probador();

console.log('== Valor por defecto ==');
const { EC, almacen } = crearEntorno();
t.afirmar('EC.fuente vale "local" por defecto', EC.fuente === 'local');
t.afirmar('las fuentes válidas son local y mysql', JSON.stringify(EC.fuentesValidas) === JSON.stringify(['local', 'mysql']));

console.log('== Solo lectura ==');
let lanzo = false;
(function () { 'use strict'; try { EC.fuente = 'mysql'; } catch (e) { lanzo = true; } })();
t.afirmar('asignar EC.fuente en modo estricto lanza error', lanzo);
t.afirmar('la asignación no cambia la fuente', EC.fuente === 'local');
t.afirmar('EC.fuente no se puede redefinir', (function () {
  try { Object.defineProperty(EC, 'fuente', { value: 'mysql' }); return false; } catch (e) { return true; }
})());
t.afirmar('la propiedad no es escribible', Object.getOwnPropertyDescriptor(EC, 'fuente').writable === false);

console.log('== No depende de localStorage ==');
almacen['educontrol_fuente'] = 'mysql';
almacen['fuente'] = 'mysql';
const otro = crearEntorno();
t.afirmar('una clave "mysql" en localStorage no cambia la fuente', otro.EC.fuente === 'local');
const codigoFuente = fs.readFileSync(path.join(__dirname, '..', 'js', 'config-fuente.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
t.afirmar('el código de config-fuente.js no usa localStorage (sin contar comentarios)', !/localStorage/.test(codigoFuente));

console.log('== Comportamiento de la fuente ==');
let ctxSinFuente = null;
try {
  const v = { window: null }; v.window = v; const c = vm.createContext(v); c.EC = {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'config-fuente.js'), 'utf8'), c);
  ctxSinFuente = c.EC;
} catch (e) { ctxSinFuente = null; }
t.afirmar('config-fuente.js se carga en un entorno limpio', ctxSinFuente && ctxSinFuente.fuente === 'local');

t.terminar();
