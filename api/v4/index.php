<?php
// =====================================================================
// EduControl v4 · Router único. NO PROBADO (PHP 8.2.12 / MariaDB 10.4.32).
// Flujo: cookie (token) -> sp_sesion_contexto (la base dice quién y con qué rol) ->
//        cuenta de conexión según el rol -> acción de la tabla -> CALL procedimiento(token, ...).
// Ningún dato del cliente identifica al usuario. Los errores no revelan detalles internos.
// =====================================================================
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/acciones.php';

header('X-Content-Type-Options: nosniff');
$accion = is_string($_GET['accion'] ?? null) ? $_GET['accion'] : '';
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---------- LOGIN (anónimo): contraseña verificada aquí; la sesión la crea la base ----------
if ($accion === 'login') {
    if ($metodo !== 'POST') { v4_responder(405, ['ok' => false, 'error' => ['codigo' => 'METODO', 'mensaje' => 'Método no permitido']]); }
    $cuerpo = json_decode((string)file_get_contents('php://input'), true);
    $usuario = is_array($cuerpo) && is_string($cuerpo['usuario'] ?? null) ? trim($cuerpo['usuario']) : '';
    $clave = is_array($cuerpo) && is_string($cuerpo['password'] ?? null) ? $cuerpo['password'] : '';
    if ($usuario === '' || $clave === '' || strlen($usuario) > 50 || strlen($clave) > 72) {
        v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => 'Usuario o contraseña no válidos']]);
    }
    $st = v4_pdo('login')->prepare('SELECT id, nombre_usuario, password, rol, estado FROM usuarios WHERE nombre_usuario = ? LIMIT 1');
    $st->execute([$usuario]);
    $fila = $st->fetch();
    $st->closeCursor();
    // Mismo mensaje y, en lo posible, mismo trabajo tanto si la cuenta no existe como si la clave es incorrecta.
    $hash = is_array($fila) ? (string)$fila['password'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_BCRYPT);
    $claveOk = password_verify($clave, $hash);
    $rolAdmitido = is_array($fila) && in_array($fila['rol'], ['ADMIN', 'PROFESOR', 'ALUMNO'], true);
    if (!is_array($fila) || !$claveOk || !$rolAdmitido || $fila['estado'] !== 'ACTIVO') {
        v4_responder(401, ['ok' => false, 'error' => ['codigo' => 'AUTH', 'mensaje' => 'Usuario o contraseña incorrectos']]);
    }
    $token = bin2hex(random_bytes(32));    // 64 caracteres hexadecimales
    $horas = (int)v4_config()['horas_sesion'];
    $sc = v4_pdo('login')->prepare('CALL sp_sesion_crear(?, ?, ?)');
    try {
        $sc->execute([(int)$fila['id'], $token, $horas]);
        $sc->closeCursor();
    } catch (PDOException $e) {
        v4_error_bd($e);
    }
    setcookie(V4_COOKIE, $token, [
        'expires' => time() + $horas * 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure' => (bool)v4_config()['cookie_secure'],
    ]);
    v4_responder(200, ['ok' => true, 'datos' => ['rol' => $fila['rol'], 'usuario' => $fila['nombre_usuario'],
        'csrf' => hash_hmac('sha256', $token, (string)v4_config()['secreto_csrf'])]]);
}

// ---------- A partir de aquí se exige sesión válida ----------
$token = v4_token();
if ($token === null) { v4_responder(401, ['ok' => false, 'error' => ['codigo' => 'AUTH', 'mensaje' => 'Sesión no válida']]); }

if ($accion === 'logout') {
    if ($metodo !== 'POST') { v4_responder(405, ['ok' => false, 'error' => ['codigo' => 'METODO', 'mensaje' => 'Método no permitido']]); }
    v4_exigir_csrf($token);
    try {
        $st = v4_pdo('app')->prepare('CALL sp_sesion_revocar(?)');
        $st->execute([$token]);
        $st->closeCursor();
    } catch (PDOException $e) {
        v4_error_bd($e);
    }
    setcookie(V4_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    v4_responder(200, ['ok' => true, 'datos' => []]);
}

$ctx = v4_contexto($token);                 // la base resuelve identidad, rol y estado
$rol = (string)$ctx['rol'];
$cuenta = $rol === 'ADMIN' ? 'admin' : 'app';

if ($accion === 'contexto') {
    v4_responder(200, ['ok' => true, 'datos' => ['rol' => $rol, 'usuario' => $ctx['nombre_usuario'],
        'csrf' => v4_csrf($token)]]);
}

// ---------- Lecturas administrativas directas (solo ADMIN, cuenta admin) ----------
if (isset(V4_LECTURAS_ADMIN[$accion])) {
    if ($metodo !== 'GET') { v4_responder(405, ['ok' => false, 'error' => ['codigo' => 'METODO', 'mensaje' => 'Método no permitido']]); }
    if ($rol !== 'ADMIN') { v4_responder(403, ['ok' => false, 'error' => ['codigo' => 'PERM', 'mensaje' => 'Operación no permitida para su rol']]); }
    $sql = V4_LECTURAS_ADMIN[$accion];
    $params = [];
    if (str_contains($sql, '?')) {
        $params[] = v4_valor('i', 'periodo_id', $_GET['periodo_id'] ?? null);
    }
    try {
        $st = v4_pdo('admin')->prepare($sql);
        $st->execute($params);
        $datos = $st->fetchAll();
        $st->closeCursor();
    } catch (PDOException $e) {
        v4_error_bd($e);
    }
    v4_responder(200, ['ok' => true, 'datos' => $datos]);
}

// ---------- Acciones de la tabla ----------
if (!isset(V4_ACCIONES[$accion])) { v4_responder(404, ['ok' => false, 'error' => ['codigo' => 'NO_EXISTE', 'mensaje' => 'Acción no encontrada']]); }
$def = V4_ACCIONES[$accion];
if ($metodo !== $def['m']) { v4_responder(405, ['ok' => false, 'error' => ['codigo' => 'METODO', 'mensaje' => 'Método no permitido']]); }
if (!in_array($rol, $def['roles'], true)) { v4_responder(403, ['ok' => false, 'error' => ['codigo' => 'PERM', 'mensaje' => 'Operación no permitida para su rol']]); }
if ($def['m'] === 'POST') { v4_exigir_csrf($token); }

$entrada = $def['m'] === 'POST'
    ? (json_decode((string)file_get_contents('php://input'), true) ?? [])
    : $_GET;
if (!is_array($entrada)) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => 'Datos no válidos']]); }

$params = [$token];
foreach ($def['args'] as $nombre => $tipo) {
    if (!array_key_exists($nombre, $entrada)) {
        v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Falta el parámetro: $nombre"]]);
    }
    $params[] = v4_valor($tipo, $nombre, $entrada[$nombre]);
}
$marcas = implode(',', array_fill(0, count($params), '?'));
try {
    $st = v4_pdo($cuenta)->prepare('CALL ' . $def['sp'] . "($marcas)");
    $st->execute($params);
    $datos = $st->fetchAll();
    $st->closeCursor();
} catch (PDOException $e) {
    v4_error_bd($e);
}
v4_responder(200, ['ok' => true, 'datos' => $datos]);
