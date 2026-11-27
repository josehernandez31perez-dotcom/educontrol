/* Etapa E · exportación (js/exportar.js): CSV, ZIP/XLSX y PDF, validados por su estructura real. */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const { probador } = require('./helpers');
const t = probador();

function cargar() {
  const ctx = { window: {} }; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'exportar.js'), 'utf8'), ctx, { filename: 'exportar.js' });
  return ctx.EC.exportar;
}
const X = cargar();
const aTexto = bytes => Buffer.from(bytes).toString('latin1');
const utf8 = bytes => Buffer.from(bytes).toString('utf8');

console.log('== CSV ==');
const csv = X.csv(['Nombre', 'Nota'], [['Ana, Pérez', '4.1'], ['Di "hola"', 'x;y']]);
t.afirmar('empieza con BOM UTF-8 para Excel', csv.charCodeAt(0) === 0xFEFF);
t.afirmar('separador punto y coma y fin de línea CRLF', csv.indexOf('Nombre;Nota\r\n') === 1);
t.afirmar('un campo con punto y coma se entrecomilla', csv.indexOf('"x;y"') !== -1);
t.afirmar('las comillas dobles se escapan', csv.indexOf('"Di ""hola"""') !== -1);
t.afirmar('los acentos se conservan', csv.indexOf('Pérez') !== -1);

console.log('== CRC-32 (vector conocido) ==');
t.afirmar('CRC-32 de "123456789" es CBF43926', X._crc32(Buffer.from('123456789')) === 0xCBF43926, X._crc32(Buffer.from('123456789')).toString(16));

// Lector de ZIP independiente del generador (lee el directorio central)
function leerZip(bytes) {
  const b = Buffer.from(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) { if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) { throw new Error('sin registro de fin de ZIP'); }
  const n = b.readUInt16LE(eocd + 10), cdOff = b.readUInt32LE(eocd + 16);
  const entradas = {};
  let p = cdOff;
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) { throw new Error('directorio central mal formado'); }
    const method = b.readUInt16LE(p + 10), crc = b.readUInt32LE(p + 16);
    const csize = b.readUInt32LE(p + 20), usize = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32);
    const off = b.readUInt32LE(p + 42);
    const nombre = b.slice(p + 46, p + 46 + nl).toString('utf8');
    if (b.readUInt32LE(off) !== 0x04034b50) { throw new Error('cabecera local mal formada: ' + nombre); }
    const ini = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
    const datos = b.slice(ini, ini + csize);
    entradas[nombre] = { method, crc, usize, datos, crcOk: X._crc32(datos) === crc && csize === usize };
    p += 46 + nl + el + cl;
  }
  return entradas;
}

// Comprobación de XML bien formado (etiquetas equilibradas) sin dependencias
function xmlBienFormado(s) {
  const re = /<\/?([A-Za-z_][\w:.-]*)[^>]*?(\/)?>/g;
  const pila = []; let m;
  while ((m = re.exec(s)) !== null) {
    if (m[0].startsWith('<?')) { continue; }
    if (m[0].startsWith('</')) { if (pila.pop() !== m[1]) { return false; } }
    else if (!m[2]) { pila.push(m[1]); }
  }
  return pila.length === 0;
}

console.log('== XLSX ==');
const xl = X.xlsx([{ nombre: 'Calificaciones', encabezados: ['Estudiante', 'Nota'], filas: [['Ana Pérez', '4.1'], ['Lucía & <Martínez>', 3]] }]);
const z = leerZip(xl);
t.afirmar('contiene las partes obligatorias de un libro', ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml'].every(n => z[n]));
t.afirmar('todos los CRC del ZIP son correctos', Object.values(z).every(e => e.crcOk));
t.afirmar('todas las partes XML están bien formadas', Object.keys(z).every(n => xmlBienFormado(utf8(z[n].datos))));
const hoja = utf8(z['xl/worksheets/sheet1.xml'].datos);
t.afirmar('el texto con & y < se escapa', hoja.indexOf('Lucía &amp; &lt;Martínez&gt;') !== -1);
t.afirmar('la hoja tiene las filas de encabezado y datos', (hoja.match(/<row /g) || []).length === 3);
t.afirmar('el nombre de hoja se sanea y se limita a 31 caracteres', utf8(z['xl/workbook.xml'].datos).indexOf('name="Calificaciones"') !== -1);
const hojaLarga = X.xlsx([{ nombre: 'a[b]:c*d?e/f\\g'.repeat(3), encabezados: [], filas: [] }]);
const nombreSaneado = utf8(leerZip(hojaLarga)['xl/workbook.xml'].datos).match(/name="([^"]*)"/)[1];
t.afirmar('nombre de hoja sin caracteres prohibidos y de 31 caracteres como máximo', !/[\[\]:*?\/\\]/.test(nombreSaneado) && nombreSaneado.length <= 31, nombreSaneado);
const anchas = X.xlsx([{ nombre: 'Ancha', encabezados: Array.from({ length: 28 }, (_, i) => 'C' + i), filas: [] }]);
t.afirmar('después de la columna Z aparecen AA y AB', utf8(leerZip(anchas)['xl/worksheets/sheet1.xml'].datos).indexOf('r="AB1"') !== -1);

console.log('== PDF ==');
const pdfBytes = X.pdf('Reporte', ['Nombre', 'Nota'], Array.from({ length: 120 }, (_, i) => ['Estudiante ' + i, String(i % 5 + 1) + '.0']));
const pdfTxt = aTexto(pdfBytes);
t.afirmar('empieza con la cabecera PDF', pdfTxt.startsWith('%PDF-1.4'));
t.afirmar('termina con %%EOF', pdfTxt.trimEnd().endsWith('%%EOF'));
const sx = Number(pdfTxt.match(/startxref\n(\d+)\n/)[1]);
t.afirmar('startxref apunta a la tabla xref', pdfTxt.substr(sx, 4) === 'xref');
const lineas = pdfTxt.substr(sx).split('\n');
const total = Number(lineas[1].split(' ')[1]);
let malos = 0;
for (let i = 1; i < total; i++) {
  const off = Number(lineas[2 + i].slice(0, 10));
  if (pdfTxt.substr(off, (i + ' 0 obj').length) !== i + ' 0 obj') { malos++; }
}
t.afirmar('todas las entradas del xref apuntan a su objeto', malos === 0 && total > 1, 'malos=' + malos);
const paginas = (pdfTxt.match(/\/Type \/Page[ >\/]/g) || []).length;
t.afirmar('120 filas se reparten en 3 páginas', paginas === 3, 'páginas=' + paginas);
t.afirmar('los paréntesis del texto se escapan', X.pdf('x', ['a'], [['(b)']]).length > 0 && aTexto(X.pdf('x', ['a'], [['(b)']])).indexOf('\\(b\\)') !== -1);

t.terminar();
