
<?php
// api/registrar_estudiante.php
require_once __DIR__ . '/bootstrap.php';

// Solo acepta solicitudes POST
requerir_metodo('POST');

// Solo permite administradores
requerir_rol('ADMIN');

// Comprueba el token de seguridad CSRF
requerir_csrf();

// Recibe los datos enviados en formato JSON
$datos = leer_json();

$cedula   = trim((string)($datos['cedula'] ?? ''));
$nombre   = trim((string)($datos['nombre'] ?? ''));
$apellido = trim((string)($datos['apellido'] ?? ''));
$estado   = strtoupper(trim((string)($datos['estado'] ?? 'ACTIVO')));

// Validaciones
$errores = [];

if ($cedula === '' || strlen($cedula) > 20) {
    $errores['cedula'] = 'La cédula es obligatoria y no debe superar 20 caracteres.';
}

if ($nombre === '' || strlen($nombre) > 60) {
    $errores['nombre'] = 'El nombre es obligatorio y no debe superar 60 caracteres.';
}

if ($apellido === '' || strlen($apellido) > 60) {
    $errores['apellido'] = 'El apellido es obligatorio y no debe superar 60 caracteres.';
}

$estadosPermitidos = ['ACTIVO', 'INACTIVO', 'RETIRADO', 'GRADUADO'];

if (!in_array($estado, $estadosPermitidos, true)) {
    $errores['estado'] = 'El estado seleccionado no es válido.';
}

if (!empty($errores)) {
    responder_json(422, [
        'ok' => false,
        'mensaje' => 'Revisa los datos del formulario.',
        'errores' => $errores
    ]);
}

try {
    $sql = "INSERT INTO estudiantes (cedula, nombre, apellido, estado)
            VALUES (:cedula, :nombre, :apellido, :estado)";

    $consulta = $conexion->prepare($sql);

    $consulta->execute([
        ':cedula' => $cedula,
        ':nombre' => $nombre,
        ':apellido' => $apellido,
        ':estado' => $estado
    ]);

    responder_json(201, [
        'ok' => true,
        'mensaje' => 'Estudiante registrado correctamente.',
        'estudiante' => [
            'id' => (int)$conexion->lastInsertId(),
            'cedula' => $cedula,
            'nombre' => $nombre,
            'apellido' => $apellido,
            'estado' => $estado
        ]
    ]);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        responder_json(409, [
            'ok' => false,
            'mensaje' => 'Ya existe un estudiante registrado con esa cédula.',
            'errores' => [
                'cedula' => 'Esta cédula ya está registrada.'
            ]
        ]);
    }

    error_log('EduControl: error al registrar estudiante: ' . $e->getMessage());

    responder_json(500, [
        'ok' => false,
        'mensaje' => 'No fue posible registrar el estudiante.'
    ]);
}
