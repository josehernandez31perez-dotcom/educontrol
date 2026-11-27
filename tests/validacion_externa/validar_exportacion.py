"""Validación independiente de la exportación (no es una prueba de Node).
Requiere Python 3 y Node.js. Genera ejemplos con js/exportar.js y los valida con herramientas de Python.
Uso (desde la carpeta del proyecto):  python3 tests/validacion_externa/validar_exportacion.py
"""
import os, re, subprocess, sys, tempfile, zipfile
import xml.dom.minidom as minidom

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
tmp = tempfile.mkdtemp()
js = """
const fs=require('fs'),vm=require('vm');const ctx={window:{}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/exportar.js','utf8'),ctx);
const X=ctx.EC.exportar;
fs.writeFileSync(process.argv[1]+'/ejemplo.xlsx',Buffer.from(X.xlsx([{nombre:'Calif',encabezados:['Estudiante','Nota'],
  filas:[['Ana Pérez','4.1'],['Lucía & <Martínez>','3']]}])));
const p=X.pdf('Reporte',['Nombre','Nota'],Array.from({length:120},(_,i)=>['Estudiante '+i,'3.0']));
fs.writeFileSync(process.argv[1]+'/ejemplo.pdf',Buffer.from(p));
"""
subprocess.run(['node', '-e', js, tmp], cwd=RAIZ, check=True)

errores = 0
def fallo(msg):
    global errores
    errores += 1
    print('  FALLO:', msg)

# XLSX
x = os.path.join(tmp, 'ejemplo.xlsx')
with zipfile.ZipFile(x) as z:
    if z.testzip() is not None:
        fallo('CRC incorrecto en el XLSX')
    for n in z.namelist():
        try:
            minidom.parseString(z.read(n))
        except Exception as e:
            fallo('XML mal formado en %s: %s' % (n, e))
    hoja = minidom.parseString(z.read('xl/worksheets/sheet1.xml'))
    textos = [t.firstChild.data for t in hoja.getElementsByTagName('t')]
    if 'Lucía & <Martínez>' not in textos:
        fallo('escape XML o acentos incorrectos')
print('XLSX:', 'correcto' if errores == 0 else 'con errores', '-', len(z.namelist()), 'partes')

# PDF
p = open(os.path.join(tmp, 'ejemplo.pdf'), 'rb').read()
if not p.startswith(b'%PDF-1.4'):
    fallo('cabecera PDF incorrecta')
sx = int(re.search(rb'startxref\n(\d+)\n', p).group(1))
if p[sx:sx + 4] != b'xref':
    fallo('startxref no apunta a xref')
bloque = p[sx:].split(b'\n')
total = int(bloque[1].split()[1])
for i in range(1, total):
    off = int(bloque[2 + i][:10])
    if not p[off:].startswith(str(i).encode() + b' 0 obj'):
        fallo('offset incorrecto del objeto %d' % i)
paginas = len(re.findall(rb'/Type /Page[ >/]', p))
if paginas != 3:
    fallo('se esperaban 3 páginas y hay %d' % paginas)
print('PDF:', 'correcto' if errores == 0 else 'con errores', '-', paginas, 'páginas')

print('RESULTADO:', 'OK' if errores == 0 else '%d errores' % errores)
sys.exit(1 if errores else 0)
