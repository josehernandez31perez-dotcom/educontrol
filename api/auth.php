<?php
// api/auth.php - Sesiones del servidor, control de roles y protección CSRF.
// Se carga desde bootstrap.php. No imprime nada.

// Indica si la sesión superó la inactividad o la duración máxima
function sesion_caducada(): bool
{
    if (!isset($_SESSION['inicio'], $_SESSION['ultima_actividad'])) {
        return true;
    }
    $ahora = time();
    return ($ahora - (int) $_SESSION['ultima_actividad']) > EC_SESION_INACTIVIDAD
        || ($ahora - (int) $_SESSION['inicio']) > EC_SESION_DURACION;
}

// Vacía la sesión del servidor y borra la cookie del navegador
function cerrar_sesion_servidor(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $parametros = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $parametros['path'],
            'domain'   => $parametros['domain'],
            'secure'   => $parametros['secure'],
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
    session_destroy();
}

// Devuelve el usuario de la sesión, o null si no hay sesión o caducó
function usuario_sesion(): ?array
{
    if (empty($_SESSION['usuario_id'])) {
        return null;
    }
    if (sesion_caducada()) {
        cerrar_sesion_servidor();
        return null;
    }
    $_SESSION['ultima_actividad'] = time();
    return [
        'id'      => (int) $_SESSION['usuario_id'],
        'usuario' => (string) $_SESSION['usuario'],
        'rol'     => (string) $_SESSION['rol'],
    ];
}

// Exige sesión válida. Si no la hay, responde 401.
function requerir_sesion(): array
{
    $usuario = usuario_sesion();
    if ($usuario === null) {
        responder_json(401, ['ok' => false, 'mensaje' => 'Tu sesión no está iniciada o ha caducado.']);
    }
    return $usuario;
}

// Exige sesión y un rol concreto. Si el rol no coincide, responde 403.
function requerir_rol(string $rol): array
{
    $usuario = requerir_sesion();
    if ($usuario['rol'] !== $rol) {
        responder_json(403, ['ok' => false, 'mensaje' => 'No tienes permiso para realizar esta acción.']);
    }
    return $usuario;
}

// Token CSRF de la sesión actual (se crea si no existe)
function token_csrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

// Comprueba el token enviado en la cabecera X-CSRF-Token. Si no coincide, responde 403.
function requerir_csrf(): void
{
    $esperado = $_SESSION['csrf'] ?? '';
    $enviado = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($esperado === '' || !is_string($enviado) || !hash_equals($esperado, $enviado)) {
        responder_json(403, ['ok' => false, 'mensaje' => 'La sesión de seguridad no es válida. Recarga la página.']);
    }
}
