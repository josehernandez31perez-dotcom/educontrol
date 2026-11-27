<?php
// api/login.php - Inicio de sesión con nombre de usuario y contraseña (password_verify).
// Solo acepta POST con token CSRF válido. No modifica la base de datos.
require_once __DIR__ . '/bootstrap.php';
requerir_metodo('POST');
requerir_csrf();

$datos = leer_json();
$nombre = trim((string) ($datos['usuario'] ?? ''));
$clave = (string) ($datos['clave'] ?? '');

if ($nombre === '' || $clave === '' || mb_strlen($nombre) > 50 || strlen($clave) > 255) {
    responder_json(400, ['ok' => false, 'mensaje' => 'Escribe tu usuario y contraseña.']);
}

$consulta = $conexion->prepare('SELECT id, nombre_usuario, password, rol FROM usuarios WHERE nombre_usuario = ? LIMIT 1');
$consulta->execute([$nombre]);
$fila = $consulta->fetch();

// Si el usuario no existe, se compara igualmente con un hash de referencia fijo
// (bcrypt, coste 10) para que el tiempo de respuesta no revele qué usuarios existen.
// Es un hash válido para password_verify() que no corresponde a ninguna cuenta real.
const EC_HASH_REFERENCIA = '$2y$10$ZSNBseZw8cUxXR9OiRkAlOHzDCc2ZPndl7wP8Wdcf9b6sIBYuxoC6';

$hashComparado = $fila ? (string) $fila['password'] : EC_HASH_REFERENCIA;
$coincide = password_verify($clave, $hashComparado);

if (!$fila || !$coincide || !in_array($fila['rol'], ['ADMIN', 'CONSULTA'], true)) {
    responder_json(401, ['ok' => false, 'mensaje' => 'Usuario o contraseña incorrectos.']);
}

// Nueva sesión para este usuario (evita fijación de sesión)
session_regenerate_id(true);
unset($_SESSION['csrf']);
$_SESSION['usuario_id'] = (int) $fila['id'];
$_SESSION['usuario'] = (string) $fila['nombre_usuario'];
$_SESSION['rol'] = (string) $fila['rol'];
$_SESSION['inicio'] = time();
$_SESSION['ultima_actividad'] = time();

responder_json(200, [
    'ok'      => true,
    'usuario' => $_SESSION['usuario'],
    'rol'     => $_SESSION['rol'],
    'csrf'    => token_csrf(),
]);
