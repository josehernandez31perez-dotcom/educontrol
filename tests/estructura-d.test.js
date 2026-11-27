/* Etapa D: comprobaciones estáticas de las páginas y del código migrado.
   Orden de scripts, bloqueo de escrituras en modo MySQL y ausencia de lecturas síncronas antiguas. */
const fs = require('fs'), path = require('path');
const { probador } = require('./helpers');
const t = probador();

const raiz = path.join(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const html = [];
(function recorrer(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    if (n === '.git' || n === 'tests') { return; }
    if (fs.statSync(p).isDirectory()) { recorrer(p); }
    else if (n.endsWith('.html')) { html.push(path.relative(raiz, p)); }
  });
})(raiz);

console.log('== Orden de scripts ==');
const conStorage = html.filter(h => leer(h).includes('js/storage.js'));
t.afirmar('todas las páginas que cargan storage.js cargan config-fuente.js antes',
  conStorage.length > 0 && conStorage.every(h => leer(h).indexOf('js/config-fuente.js') !== -1 &&
    leer(h).indexOf('js/config-fuente.js') < leer(h).indexOf('js/storage.js')), conStorage.length);

const lectura = {
  'index.html': 'dashboard.js', 'estadisticas/index.html': 'estadisticas.js', 'reportes/index.html': 'reportes.js',
  'reportes/individual.html': 'reportes.js', 'reportes/general.html': 'reportes.js',
  'estudiantes/detalle.html': 'estudiantes-detalle.js', 'calificaciones/index.html': 'calificaciones.js',
  'estudiantes/index.html': 'estudiantes.js'
};
Object.keys(lectura).forEach(h => {
  const s = leer(h);
  const orden = ['js/layout.js', 'js/datos-mysql.js', 'js/datos.js', lectura[h]].map(f => s.indexOf(f));
  t.afirmar(h + ': layout, datos-mysql, datos y su script en ese orden',
    orden.every(i => i !== -1) && orden.every((v, i) => i === 0 || v > orden[i - 1]), orden.join(','));
});

console.log('== Bloqueo de escrituras en modo MySQL ==');
const escritura = ['estudiantes/registrar.html', 'estudiantes/editar.html', 'calificaciones/registrar.html',
  'calificaciones/editar.html', 'configuracion/index.html', 'respaldo/index.html'];
escritura.forEach(h => t.afirmar(h + ' marcada como página de escritura',
  /<body[^>]*data-escritura="true"/.test(leer(h))));
t.afirmar('ninguna pantalla de lectura está marcada como escritura',
  Object.keys(lectura).every(h => !/data-escritura="true"/.test(leer(h))));

console.log('== Código migrado sin lecturas síncronas antiguas ==');
['dashboard.js', 'estadisticas.js', 'reportes.js', 'estudiantes-detalle.js', 'calificaciones.js', 'estudiantes.js'].forEach(f => {
  const c = sinComentarios(leer('js/' + f));
  t.afirmar(f + ' no llama a EC.calculos ni a lecturas síncronas de storage',
    !/EC\.calculos\.|EC\.estudiantes\.(listar|obtener|paraSelect|buscar)\(|EC\.calificaciones\.listarDetalle\(/.test(c));
});
t.afirmar('estudiantes.js no hace peticiones directas (fetch) a la API', !/\bfetch\(/.test(sinComentarios(leer('js/estudiantes.js'))));

console.log('== Adaptador MySQL: solo lectura ==');
const adaptador = sinComentarios(leer('js/datos-mysql.js'));
t.afirmar('el adaptador no usa métodos de escritura', !/['"](POST|PUT|PATCH|DELETE)['"]/.test(adaptador));
t.afirmar('el adaptador no llama a funciones de escritura', !/EC\.(estudiantes|calificaciones|materias|usuarios)\.(crear|actualizar|eliminar|registrar|guardar)/.test(adaptador));
t.afirmar('el adaptador solo pide los tres listados', /listar_estudiantes\.php/.test(adaptador) &&
  /listar_materias\.php/.test(adaptador) && /listar_calificaciones\.php/.test(adaptador) &&
  (adaptador.match(/api\//g) || []).length === 1);

console.log('== Guardas de modo MySQL ==');
t.afirmar('storage.js no siembra datos en modo MySQL', /if \(EC\.fuente !== 'mysql'\) \{ EC\.inicializarDatos\(\); \}/.test(leer('js/storage.js')));
t.afirmar('layout.js bloquea las páginas de escritura en modo MySQL', /EC\.fuente === 'mysql' && body\.dataset\.escritura === 'true'/.test(leer('js/layout.js')));
t.afirmar('calificaciones.js oculta las acciones en modo MySQL', /puedeModificar = esAdmin && EC\.fuente !== 'mysql'/.test(leer('js/calificaciones.js')));
t.afirmar('estudiantes-detalle.js oculta Editar en modo MySQL', /puedeEditar = esAdmin && EC\.fuente !== 'mysql'/.test(leer('js/estudiantes-detalle.js')));

console.log('== La fuente sigue siendo local por defecto ==');
t.afirmar('config-fuente.js define la fuente local', /var FUENTE_ACTUAL = 'local';/.test(leer('js/config-fuente.js')));

t.terminar();
