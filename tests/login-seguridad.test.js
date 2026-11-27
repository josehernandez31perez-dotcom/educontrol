/* Comprobaciones estáticas de la API de login y de la pantalla de acceso.
   Verifican el código fuente; la ejecución real de PHP se prueba en XAMPP (ver informe). */
const fs = require('fs');
const path = require('path');
const { probador } = require('./helpers');
const t = probador();

const raiz = path.join(__dirname, '..');
const login = fs.readFileSync(path.join(raiz, 'api', 'login.php'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'login.html'), 'utf8');
const auth = fs.readFileSync(path.join(raiz, 'js', 'auth.js'), 'utf8');

console.log('== Hash de referencia fijo ==');
const constante = login.match(/const EC_HASH_REFERENCIA = '([^']*)';/);
t.afirmar('existe la constante EC_HASH_REFERENCIA', constante !== null);
const hash = constante ? constante[1] : '';
t.afirmar('el hash tiene formato bcrypt de coste 10 ($2y$10$)', /^\$2y\$10\$[./A-Za-z0-9]{53}$/.test(hash), hash);
t.afirmar('el hash de referencia mide 60 caracteres', hash.length === 60);
t.afirmar('login.php ya no llama a password_hash()', !/password_hash\s*\(/.test(login));
t.afirmar('login.php sigue usando password_verify()', /password_verify\(\$clave,\s*\$hashComparado\)/.test(login));
t.afirmar('el hash de referencia se usa cuando el usuario no existe', /\$fila\s*\?\s*\(string\)\s*\$fila\['password'\]\s*:\s*EC_HASH_REFERENCIA/.test(login));

console.log('== Mensaje genérico y consultas ==');
t.afirmar('el error de credenciales es genérico', login.includes("'mensaje' => 'Usuario o contraseña incorrectos.'"));
t.afirmar('la consulta usa parámetros preparados', /prepare\('SELECT[^']*WHERE nombre_usuario = \?/.test(login));
t.afirmar('login.php no escribe en la base de datos', !/\b(INSERT|UPDATE|DELETE)\b/i.test(login));
t.afirmar('login.php no contiene contraseñas', !/admin123|consulta123|EduControl#2026/.test(login));

console.log('== Pantalla de acceso ==');
t.afirmar('login.html ya no dice que la autenticación es demostrativa', !/demostrativ/i.test(html));
t.afirmar('login.html conserva el texto del portal', html.includes('Portal de gestión para docentes'));
t.afirmar('login.html conserva los campos usuario y clave', html.includes('id="usuario"') && html.includes('id="clave"'));

console.log('== Cierre de sesión en el navegador ==');
t.afirmar('auth.js solo confirma el cierre con datos.ok === true', /datos\.ok !== true/.test(auth));
t.afirmar('auth.js rechaza si la respuesta no es OK', /if \(!respuesta\.ok\) \{ throw/.test(auth));

t.terminar();
