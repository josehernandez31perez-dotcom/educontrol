<?php
// api/logout.php - Cierra la sesión en el servidor y borra la cookie.
require_once __DIR__ . '/bootstrap.php';
requerir_metodo('POST');

// Si hay sesión activa, el cierre exige el token CSRF.
// Si no la hay, se responde OK igualmente para limpiar el navegador.
if (usuario_sesion() !== null) {
    requerir_csrf();
}
cerrar_sesion_servidor();
responder_json(200, ['ok' => true]);
