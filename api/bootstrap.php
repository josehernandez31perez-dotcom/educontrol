<?php
// api/bootstrap.php - Base común de la API: sesión segura, cabeceras y respuestas JSON.
// Cada endpoint lo incluye al inicio:  require_once __DIR__ . '/bootstrap.php';
// Este archivo no imprime nada: no debe haber salida antes de las cabeceras.

const EC_SESION_INACTIVIDAD = 1800;   // 30 minutos sin actividad
const EC_SESION_DURACION    = 28800;  // 8 horas como máximo desde el inicio de sesión
const EC_SESION_SECURE      = false;  // true cuando el sitio se sirva por HTTPS

// Los errores de PHP se registran en el log de Apache, nunca se muestran al usuario
ini_set('display_errors', '0');
ini_set('log_errors', '1');

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
}

// Configuración de la cookie de sesión
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_trans_sid', '0');
session_name('EDUCONTROL_SID');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => EC_SESION_SECURE,
    'httponly' => true,
    'samesite' => 'Strict',
]);

// Cualquier excepción no controlada responde JSON genérico
set_exception_handler(function (Throwable $e) {
    error_log('EduControl API: ' . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'mensaje' => 'Error interno del servidor.'], JSON_UNESCAPED_UNICODE);
    exit;
});

session_start();

require_once __DIR__ . '/conexion.php';   // define $conexion (PDO)
require_once __DIR__ . '/auth.php';

// Responde JSON y termina la ejecución
function responder_json(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// Solo permite el método HTTP indicado
function requerir_metodo(string $metodo): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $metodo) {
        responder_json(405, ['ok' => false, 'mensaje' => 'Método no permitido.']);
    }
}

// Lee un cuerpo JSON de hasta 64 KB. Devuelve un arreglo vacío si no es válido.
function leer_json(): array
{
    $cuerpo = file_get_contents('php://input', false, null, 0, 65536);
    $datos = json_decode($cuerpo === false ? '' : $cuerpo, true);
    return is_array($datos) ? $datos : [];
}
