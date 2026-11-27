<?php
// api/csrf.php - Entrega el token CSRF para iniciar sesión.
require_once __DIR__ . '/bootstrap.php';
requerir_metodo('GET');
responder_json(200, ['ok' => true, 'csrf' => token_csrf()]);
