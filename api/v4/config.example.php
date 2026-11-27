<?php
// =====================================================================
// EduControl v4 · Configuración de ejemplo. COPIAR a config.php (NO versionar config.php).
// Las contraseñas reales NO van en el repositorio. NO PROBADO.
// =====================================================================
return [
    'host'    => 'localhost',
    'base'    => 'educontrol',            // en pruebas: educontrol_pruebas
    'horas_sesion' => 8,
    'cookie_secure' => false,            // true cuando haya HTTPS
    // Secreto para el token CSRF (mínimo 32 caracteres aleatorios). Generar uno nuevo.
    'secreto_csrf' => 'CAMBIAR_POR_UN_VALOR_ALEATORIO_DE_MAS_DE_32_CARACTERES',
    'cuentas' => [
        'login' => ['usuario' => 'educontrol_login', 'clave' => '<CLAVE_NO_VERSIONADA>'],
        'app'   => ['usuario' => 'educontrol_app',   'clave' => '<CLAVE_NO_VERSIONADA>'],
        'admin' => ['usuario' => 'educontrol_admin', 'clave' => '<CLAVE_NO_VERSIONADA>'],
    ],
];
