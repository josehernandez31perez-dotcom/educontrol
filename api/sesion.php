<?php
// api/sesion.php - Indica si hay sesión iniciada y devuelve usuario, rol y token CSRF.
require_once __DIR__ . '/bootstrap.php';
requerir_metodo('GET');
$usuario = usuario_sesion();
if ($usuario === null) {
    responder_json(401, ['ok' => false, 'mensaje' => 'Sesión no iniciada.']);
}
responder_json(200, [
    'ok'      => true,
    'usuario' => $usuario['usuario'],
    'rol'     => $usuario['rol'],
    'csrf'    => token_csrf(),
]);
