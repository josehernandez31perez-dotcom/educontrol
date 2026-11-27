/* Comprobaciones del modo local en la Etapa C: nada cambia para las pantallas y la inicialización
   de datos de demostración sigue igual. */
const fs = require('fs'), path = require('path');
const { crearEntorno, probador } = require('./helpers');
const t = probador();

const raiz = path.join(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const html = [];
(function recorrer(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    if (n === '.git' || n === 'tests') return;
    if (fs.statSync(p).isDirectory()) recorrer(p);
    else if (n.endsWith('.html')) html.push(path.relative(raiz, p));
  });
})(raiz);

console.log('== Etapa D: pantallas de lectura usan la capa nueva (sustituye al límite de la etapa C) ==');
t.afirmar('toda página que carga storage.js carga antes config-fuente.js', html.filter(h => leer(h).includes('js/storage.js')).every(h => leer(h).indexOf('js/config-fuente.js') !== -1 && leer(h).indexOf('js/config-fuente.js') < leer(h).indexOf('js/storage.js')));
t.afirmar('las siete pantallas de lectura cargan datos.js', ['index.html', 'estadisticas/index.html', 'reportes/index.html', 'reportes/individual.html', 'reportes/general.html', 'estudiantes/detalle.html', 'calificaciones/index.html'].every(h => leer(h).includes('js/datos.js')));
['calificaciones-form.js', 'estudiantes-form.js'].forEach(f =>
  t.afirmar(f + ' no usa EC.datos ni EC.fuente', !/EC\.(datos|fuente)\b/.test(leer('js/' + f))));
['dashboard.js', 'estadisticas.js', 'reportes.js', 'estudiantes-detalle.js', 'calificaciones.js', 'estudiantes.js'].forEach(f =>
  t.afirmar(f + ' lee con EC.datos', /EC\.datos\./.test(leer('js/' + f))));

console.log('== Inicialización de datos de demostración sin cambios ==');
const storage = leer('js/storage.js');
t.afirmar('storage.js usa EC.fuente solo en la guarda de la siembra', (storage.match(/EC\.fuente/g) || []).length === 1 && /EC\.fuente !== 'mysql'/.test(storage));
t.afirmar('storage.js conserva la siembra con VERSION_DATOS', /VERSION_DATOS/.test(storage) && /EC\.inicializarDatos\(\);/.test(storage));

const { EC, almacen } = crearEntorno();
t.afirmar('sin datos previos se siembran tres estudiantes', EC.estudiantes.listar().length === 3);
t.afirmar('la siembra sigue creando la clave de versión', almacen['educontrol_version_datos'] === '1');

console.log('== Compatibilidad del modo local ==');
t.afirmar('EC.estudiantes.buscar sigue funcionando sin tildes', EC.estudiantes.buscar('LUCIA').length === 1);
t.afirmar('EC.calculos.estadisticas sigue devolviendo el resumen esperado', EC.calculos.estadisticas().aprobados === 2);
t.afirmar('la configuración por defecto sigue siendo 3.0', EC.configuracion.obtener().notaAprobacion === 3);
// La comparación real entre capa de datos y función directa está en datos.test.js (es asíncrona).

console.log('== La fuente no se puede activar desde el navegador ==');
almacen['educontrol_fuente'] = 'mysql';
t.afirmar('una preferencia en localStorage no activa mysql', EC.fuente === 'local' && EC.datos.fuente === 'local');

t.terminar();
