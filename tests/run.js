/* tests/run.js - Ejecuta todas las pruebas de la carpeta tests/.
   Uso: node tests/run.js */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const archivos = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let conFallos = 0;

archivos.forEach(function (archivo) {
    const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], { encoding: 'utf8' });
    console.log('\n### ' + archivo);
    process.stdout.write(r.stdout + r.stderr);
    if (r.status !== 0) { conFallos++; }
});

console.log(conFallos ? '\n' + conFallos + ' archivo(s) con fallos' : '\nTodas las pruebas pasaron');
process.exit(conFallos ? 1 : 0);
