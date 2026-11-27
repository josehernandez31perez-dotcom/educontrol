<?php
// =====================================================================
// EduControl v4 · Biblioteca común. NO PROBADO (PHP 8.2.12 / MariaDB 10.4.32).
// Principios: la identidad es el token de la cookie; la base resuelve usuario, rol y estado.
// PHP solo elige la cuenta de conexión según el rol que devuelve la base.
// =====================================================================
declare(strict_types=1);

const V4_COOKIE = 'ec_sesion';

function v4_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $ruta = __DIR__ . '/config.php';
        if (!is_file($ruta)) {
            v4_responder(500, ['ok' => false, 'error' => ['codigo' => 'CONFIG', 'mensaje' => 'Configuración v4 no encontrada']]);
        }
        $cfg = require $ruta;
        if (!is_array($cfg) || strlen((string)($cfg['secreto_csrf'] ?? '')) < 32) {
            v4_responder(500, ['ok' => false, 'error' => ['codigo' => 'CONFIG', 'mensaje' => 'Configuración v4 no válida']]);
        }
    }
    return $cfg;
}

// Conexión según la cuenta: 'login', 'app' o 'admin'. Una conexión por cuenta y petición.
function v4_pdo(string $cuenta): PDO {
    static $conexiones = [];
    if (!isset($conexiones[$cuenta])) {
        $cfg = v4_config();
        $c = $cfg['cuentas'][$cuenta] ?? null;
        if ($c === null) {
            v4_responder(500, ['ok' => false, 'error' => ['codigo' => 'CONFIG', 'mensaje' => 'Cuenta de base de datos no configurada']]);
        }
        $dsn = 'mysql:host=' . $cfg['host'] . ';dbname=' . $cfg['base'] . ';charset=utf8mb4';
        $conexiones[$cuenta] = new PDO($dsn, $c['usuario'], $c['clave'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $conexiones[$cuenta];
}

function v4_responder(int $estado, array $cuerpo): never {
    http_response_code($estado);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Traduce un error de la base a respuesta HTTP. Los SIGNAL llevan "CODIGO|mensaje".
function v4_error_bd(PDOException $e): never {
    $info = $e->errorInfo ?? [null, null, null];
    $sqlstate = (string)($info[0] ?? '');
    $codigo = (int)($info[1] ?? 0);
    $texto = (string)($info[2] ?? '');
    if ($sqlstate === '45000' && preg_match('/^(AUTH|PERM|REGLA|VAL)\|(.*)$/', $texto, $m)) {
        $mapa = ['AUTH' => 401, 'PERM' => 403, 'REGLA' => 409, 'VAL' => 422];
        v4_responder($mapa[$m[1]], ['ok' => false, 'error' => ['codigo' => $m[1], 'mensaje' => $m[2]]]);
    }
    if ($codigo === 1062) { v4_responder(409, ['ok' => false, 'error' => ['codigo' => 'DUPLICADO', 'mensaje' => 'Ya existe un registro con esos datos']]); }
    if ($codigo === 1451) { v4_responder(409, ['ok' => false, 'error' => ['codigo' => 'REGLA', 'mensaje' => 'El registro tiene dependencias']]); }
    if (in_array($codigo, [1452, 1048, 1265, 1366, 4025, 1406], true)) {
        v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => 'Datos no válidos']]);
    }
    if ($codigo === 1142 || $codigo === 1143 || $codigo === 1370 || $codigo === 1044) {
        v4_responder(403, ['ok' => false, 'error' => ['codigo' => 'PERM', 'mensaje' => 'Operación no permitida']]);
    }
    error_log('[v4] error de base de datos: ' . $sqlstate . ' ' . $codigo);   // sin datos de usuario
    v4_responder(500, ['ok' => false, 'error' => ['codigo' => 'INTERNO', 'mensaje' => 'Error interno']]);
}

function v4_token(): ?string {
    $t = $_COOKIE[V4_COOKIE] ?? '';
    return (is_string($t) && preg_match('/^[a-f0-9]{64}$/', $t) === 1) ? $t : null;
}

function v4_csrf(string $token): string {
    return hash_hmac('sha256', $token, (string)v4_config()['secreto_csrf']);
}

function v4_exigir_csrf(string $token): void {
    $recibido = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($recibido) || !hash_equals(v4_csrf($token), $recibido)) {
        v4_responder(403, ['ok' => false, 'error' => ['codigo' => 'CSRF', 'mensaje' => 'Token CSRF no válido']]);
    }
}

// Contexto de la sesión: llama a sp_sesion_contexto con la cuenta de la aplicación (o admin si ya se conoce).
function v4_contexto(string $token): array {
    try {
        $st = v4_pdo('app')->prepare('CALL sp_sesion_contexto(?)');
        $st->execute([$token]);
        $fila = $st->fetch();
        $st->closeCursor();
    } catch (PDOException $e) {
        v4_error_bd($e);
    }
    if (!is_array($fila)) { v4_responder(401, ['ok' => false, 'error' => ['codigo' => 'AUTH', 'mensaje' => 'Sesión no válida']]); }
    return $fila;   // usuario_id, rol, nombre_usuario
}

// Validación de parámetros según tipo declarado en la tabla de acciones.
function v4_valor(string $tipo, string $nombre, mixed $v): mixed {
    if ($tipo === 'i') {
        if (!is_numeric($v) || (int)$v != $v || (int)$v <= 0) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Parámetro no válido: $nombre"]]); }
        return (int)$v;
    }
    if ($tipo === 'd') {
        if (!is_numeric($v) || (float)$v < 0 || (float)$v > 100) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Parámetro no válido: $nombre"]]); }
        return number_format((float)$v, 2, '.', '');
    }
    if ($tipo === 'n') {                    // nota 1.0 a 5.0
        if (!is_numeric($v) || (float)$v < 1.0 || (float)$v > 5.0) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Nota no válida: $nombre"]]); }
        return number_format((float)$v, 1, '.', '');
    }
    if ($tipo === 'f') {                    // fecha AAAA-MM-DD
        if (!is_string($v) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) !== 1) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Fecha no válida: $nombre"]]); }
        return $v;
    }
    if ($tipo === 'h') {                    // contraseña en claro: solo para convertirla en hash
        if (!is_string($v) || strlen($v) < 8 || strlen($v) > 72) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => 'La contraseña debe tener entre 8 y 72 caracteres']]); }
        return password_hash($v, PASSWORD_BCRYPT);
    }
    // 's' texto
    if (!is_string($v) || trim($v) === '' || mb_strlen($v) > 1000) { v4_responder(422, ['ok' => false, 'error' => ['codigo' => 'VAL', 'mensaje' => "Texto no válido: $nombre"]]); }
    return $v;
}
