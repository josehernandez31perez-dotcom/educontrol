/* Etapa E v4 · Comprobaciones ESTÁTICAS que cruzan SQL, PHP y JavaScript.
   Detectan desajustes entre capas (procedimiento llamado que no existe, permiso sobre algo inexistente,
   parámetros de identidad, referencias a CONSULTA, procedimientos sin definidor). NO ejecutan SQL ni PHP. */
const fs = require('fs'), path = require('path');
const { probador } = require('./helpers');
const t = probador();
const raiz = path.join(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const sinComentariosSql = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
const sinComentariosPhp = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/#.*$/gm, '');

const SQL_04 = sinComentariosSql(leer('bd/04_sesiones_v4.sql'));
// Solo los cuerpos de procedimientos y funciones (lo que está después del DELIMITER): la tabla sesiones_app va antes.
const CUERPOS_04 = SQL_04.slice(SQL_04.indexOf('DELIMITER $$'));
const SQL = CUERPOS_04 + '\n' + sinComentariosSql(leer('bd/05_procedimientos_v4.sql'));
const SQL_PERMISOS = sinComentariosSql(leer('bd/06_permisos_v4.sql'));
const PHP_ACCIONES = sinComentariosPhp(leer('api/v4/acciones.php'));
const PHP_TODO = ['api/v4/lib.php', 'api/v4/acciones.php', 'api/v4/index.php'].map(f => sinComentariosPhp(leer(f))).join('\n');
const JS_V4 = ['js/v4/cliente.js', 'js/v4/vistas.js', 'js/v4/paneles.js', 'js/v4/app.js'].map(leer).join('\n');

// Procedimientos y funciones definidos en SQL
const definidos = [...SQL.matchAll(/CREATE\s+DEFINER\s*=\s*'[^']+'@'[^']+'\s+(PROCEDURE|FUNCTION)\s+(\w+)/g)];
const nombres = definidos.map(m => m[2]);
const publicos = nombres.filter(n => !n.startsWith('sp_interno_'));

console.log('== Procedimientos: definidor y firma ==');
const creaciones = (SQL.match(/CREATE\s+(DEFINER\s*=|PROCEDURE|FUNCTION)/g) || []).length;
t.afirmar('todos los procedimientos y funciones declaran DEFINER = educontrol_definer', definidos.length > 0 && definidos.length === creaciones && definidos.every(m => /educontrol_definer/.test(m[0])), definidos.length + ' de ' + creaciones);
t.afirmar('ningún procedimiento usa el parámetro p_actor (identidad no suministrable)', !/p_actor/.test(SQL));
const sinToken = publicos.filter(n => n !== 'fn_usuario_de_sesion' && n !== 'sp_sesion_crear').filter(n => !new RegExp('PROCEDURE\\s+' + n + '\\s*\\(\\s*IN\\s+p_token', 'i').test(SQL));
t.afirmar('todo procedimiento público recibe p_token como primer parámetro', sinToken.length === 0, 'sin p_token: ' + sinToken.join(','));
t.afirmar('sp_sesion_crear recibe el usuario porque lo llama solo el login (cuenta educontrol_login)', /sp_sesion_crear\(IN p_usuario_id/.test(SQL));
t.afirmar('la función de sesión no usa FOR UPDATE (un bloqueo en autocommit no protege nada)', (() => {
  const m = SQL.match(/CREATE\s+DEFINER[^;]*?FUNCTION\s+fn_usuario_de_sesion[\s\S]*?END\$\$/);
  return m !== null && !/FOR\s+UPDATE/i.test(m[0]);
})());
t.afirmar('la función de sesión es de solo lectura (READS SQL DATA)', /FUNCTION\s+fn_usuario_de_sesion[\s\S]*?READS SQL DATA/.test(SQL));
t.afirmar('los errores de negocio usan el formato CODIGO|mensaje reconocido por PHP', /SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '(AUTH|PERM|REGLA|VAL)\|/.test(SQL));
t.afirmar('las escrituras de negocio abren transacción', (SQL.match(/START TRANSACTION/g) || []).length >= 30);
t.afirmar('ningún procedimiento contiene DDL (causaría COMMIT implícito)', !/\b(CREATE TABLE|ALTER TABLE|DROP TABLE|TRUNCATE)\b/i.test(SQL));
t.afirmar('todo procedimiento declara el manejador de NOT FOUND (SELECT INTO sin filas)', (SQL.match(/CREATE\s+DEFINER/g) || []).length === (SQL.match(/CONTINUE HANDLER FOR NOT FOUND/g) || []).length);

// Equilibrio de bloques: cada BEGIN tiene su END. Los CASE de expresión se cierran con END y se descuentan.
const bloquesSql = SQL.split(/(?=CREATE\s+DEFINER)/).slice(1);
const desequilibrados = bloquesSql.filter(b => {
  const abre = (b.match(/\bBEGIN\b/g) || []).length;
  const casos = (b.match(/\bCASE\b/g) || []).length;
  const finesTotales = (b.match(/\bEND\b(?!\s+IF\b)(?!\s+LOOP\b)(?!\s+WHILE\b)(?!\$\$)/g) || []).length;
  return abre !== finesTotales - casos + 1;   // +1: el END$$ del propio objeto
});
t.afirmar('todo BEGIN de procedimientos y funciones tiene su END (descontando CASE de expresión)', bloquesSql.length > 0 && desequilibrados.length === 0, 'desequilibrados: ' + desequilibrados.length);
const ifsAbiertos = (SQL.match(/\bIF\b/g) || []).length - (SQL.match(/END IF/g) || []).length;
const ifsCerrados = (SQL.match(/END IF/g) || []).length;
t.afirmar('todo IF tiene su END IF (IF que abren = END IF que cierran)', ifsAbiertos === ifsCerrados && ifsCerrados > 0, ifsAbiertos + ' abiertos, ' + ifsCerrados + ' cerrados');

console.log('== Coherencia PHP -> SQL ==');
const llamadas = [...PHP_ACCIONES.matchAll(/'sp' => '(sp_\w+)'/g)].map(m => m[1]);
t.afirmar('la tabla de acciones PHP tiene procedimientos declarados', llamadas.length >= 30, String(llamadas.length));
t.afirmar('cada procedimiento que llama PHP existe en SQL', llamadas.every(n => nombres.includes(n)), llamadas.filter(n => !nombres.includes(n)).join(','));
const sesionPhp = [...PHP_TODO.matchAll(/CALL (sp_\w+)/g)].map(m => m[1]);
t.afirmar('cada CALL directo de PHP existe en SQL', sesionPhp.every(n => nombres.includes(n)), sesionPhp.filter(n => !nombres.includes(n)).join(','));
const lecturasPhp = [...PHP_ACCIONES.matchAll(/'sp' => 'sp_(prof|alum|comun)_\w+'/g)].length;
const bloqueAlum = PHP_ACCIONES.split("'alum.mis_inscripciones'")[1].split("'comun.mi_perfil'")[0];
t.afirmar('las acciones de ALUMNO y COMÚN no reciben identificadores de usuario ni de alumno', !/usuario_id|estudiante_id|usuario/.test(bloqueAlum), bloqueAlum.slice(0, 80));

console.log('== Permisos: cada GRANT apunta a algo existente ==');
const otorgados = [...SQL_PERMISOS.matchAll(/GRANT\s+EXECUTE\s+ON\s+PROCEDURE\s+educontrol\.(\w+)/g)].map(m => m[1]);
t.afirmar('todo EXECUTE concedido apunta a un procedimiento existente', otorgados.every(n => nombres.includes(n)), otorgados.filter(n => !nombres.includes(n)).join(','));
t.afirmar('la cuenta de la aplicación no recibe EXECUTE de ningún sp_admin_*', (() => {
  const app = [...SQL_PERMISOS.matchAll(/GRANT EXECUTE ON PROCEDURE educontrol\.(\w+) TO 'educontrol_app'/g)].map(m => m[1]);
  return app.length > 0 && app.every(n => !/^sp_admin_/.test(n));
})());
t.afirmar('la cuenta de login es la única con SELECT de password', (() => {
  const con = [...SQL_PERMISOS.matchAll(/GRANT SELECT \(([^)]*)\) ON educontrol\.usuarios TO '(\w+)'/g)];
  return con.filter(m => /password/.test(m[1])).map(m => m[2]).join() === 'educontrol_login';
})());
t.afirmar('ninguna cuenta de aplicación tiene DELETE', !/GRANT[^;]*\bDELETE\b[^;]*TO 'educontrol_(app|admin|login)'/.test(SQL_PERMISOS));
t.afirmar('ninguna cuenta de aplicación recibe INSERT o UPDATE directos sobre calificaciones', (() => {
  const m = [...SQL_PERMISOS.matchAll(/GRANT[^;]*calificaciones[^;]*TO '(educontrol_\w+)'/g)];
  return m.every(x => x[1] === 'educontrol_definer' || !/INSERT|UPDATE/.test(x[0])) && m.length > 0;
})());
t.afirmar('la cuenta del propietario de procedimientos está bloqueada', /CREATE USER 'educontrol_definer'[^;]*ACCOUNT LOCK/.test(SQL_PERMISOS));

console.log('== Identidad: sin parámetros de usuario de origen cliente ==');
t.afirmar('PHP no lee identidad del cliente (ningún parámetro llamado usuario_actual, actor ni rol)', !/\b(actor|usuario_actual|mi_usuario|rol_cliente)\b/.test(PHP_TODO));
t.afirmar('la tabla de acciones no tiene parámetros de identidad', !/'args' => \[[^\]]*'(actor|usuario_actual|rol)'/.test(PHP_ACCIONES));
t.afirmar('las acciones de alumno no reciben ningún parámetro', /'alum\.mis_resultados' => \[[^\n]*'args' => \[\]/.test(PHP_ACCIONES) && /'alum\.promedios' => \[[^\n]*'args' => \[\]/.test(PHP_ACCIONES));
t.afirmar('el rol se toma de la base (sp_sesion_contexto) y no del cliente', /CALL sp_sesion_contexto\(\?\)/.test(PHP_TODO) && !/\$_(GET|POST|COOKIE)\[['"]rol['"]\]/.test(PHP_TODO));
t.afirmar('el router rechaza cualquier acción que no esté en la tabla', /isset\(V4_ACCIONES\[\$accion\]\)/.test(PHP_TODO));
t.afirmar('ADMIN usa la cuenta admin y el resto la cuenta app', /\$cuenta = \$rol === 'ADMIN' \? 'admin' : 'app'/.test(PHP_TODO));
t.afirmar('todas las escrituras exigen token CSRF', /v4_exigir_csrf\(\$token\)/.test(PHP_TODO) && /if \(\$def\['m'\] === 'POST'\) \{ v4_exigir_csrf/.test(PHP_TODO));

console.log('== Cookie de sesión y secretos ==');
t.afirmar('la cookie de sesión es HttpOnly y SameSite=Strict', /'httponly' => true/.test(PHP_TODO) && /'samesite' => 'Strict'/.test(PHP_TODO));
t.afirmar('el token es aleatorio de 32 bytes (random_bytes)', /random_bytes\(32\)/.test(PHP_TODO));
t.afirmar('la contraseña no se registra en ningún log', !/error_log\([^)]*(clave|password)/i.test(PHP_TODO));
t.afirmar('ningún secreto real está en el repositorio (solo config.example.php)', !fs.existsSync(path.join(raiz, 'api/v4/config.php')));
t.afirmar('la configuración de ejemplo usa marcadores, no claves', /<CLAVE_NO_VERSIONADA>/.test(leer('api/v4/config.example.php')));

console.log('== Interfaz: el cliente no envía identidad ni confía en el rol de la pantalla ==');
t.afirmar('el cliente no envía usuario_id ni rol en cabeceras ni en el cuerpo', !/usuario_id|['"]rol['"]\s*:/.test(leer('js/v4/cliente.js')));
t.afirmar('el cliente envía el token CSRF solo en cabecera', /X-CSRF-Token/.test(leer('js/v4/cliente.js')));
t.afirmar('las celdas de datos se escapan al mostrarse', /'<td>' \+ esc\(f\[c\.clave\]\)/.test(leer('js/v4/vistas.js')));
const bloqueAlumnoPanel = leer('js/v4/paneles.js').split('alumno: [')[1].split('\n        ]')[0];
t.afirmar('el panel del alumno no muestra rankings ni posiciones', !/ranking|posicion/i.test(bloqueAlumnoPanel));

console.log('== CONSULTA: ninguna referencia en el código v4 ni en las pruebas nuevas ==');
const ficherosV4 = ['api/v4/lib.php', 'api/v4/acciones.php', 'api/v4/index.php', 'api/v4/config.example.php',
  'js/v4/cliente.js', 'js/v4/vistas.js', 'js/v4/paneles.js', 'js/v4/app.js', 'v4/login.html', 'v4/index.html',
  'bd/01_nueva_estructura.sql', 'bd/04_sesiones_v4.sql', 'bd/05_procedimientos_v4.sql', 'bd/06_permisos_v4.sql'];
t.afirmar('ningún archivo v4 nombra el rol CONSULTA', ficherosV4.every(f => !/CONSULTA/.test(leer(f))), ficherosV4.filter(f => /CONSULTA/.test(leer(f))).join(','));
t.afirmar('la migración solo menciona CONSULTA en la verificación previa (paso 0), nunca en un ENUM', /rol = 'CONSULTA'/.test(leer('bd/02_migracion.sql')) && !/ENUM\([^)]*CONSULTA/.test(leer('bd/02_migracion.sql')));

t.terminar();
