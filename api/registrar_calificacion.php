
<?php
// api/registrar_calificacion.php
require_once __DIR__ . '/bootstrap.php';

// Solo acepta solicitudes POST
requerir_metodo('POST');

// Solo permite administradores
requerir_rol('ADMIN');

// Comprueba el token de seguridad CSRF
requerir_csrf();

// Recibe los datos enviados en formato JSON
$datos = leer_json();

$estudianteId = filter_var(
    $datos['estudiante_id'] ?? null,
    FILTER_VALIDATE_INT
);

$materiaId = filter_var(
    $datos['materia_id'] ?? null,
    FILTER_VALIDATE_INT
);

$notaTexto = trim((string)($datos['nota'] ?? ''));

// Validaciones
$errores = [];

if ($estudianteId === false || $estudianteId === null || $estudianteId < 1) {
    $errores['estudiante_id'] = 'Selecciona un estudiante válido.';
}

if ($materiaId === false || $materiaId === null || $materiaId < 1) {
    $errores['materia_id'] = 'Selecciona una materia válida.';
}

if (
    $notaTexto === '' ||
    !is_numeric($notaTexto) ||
    (float)$notaTexto < 1 ||
    (float)$notaTexto > 5
) {
    $errores['nota'] = 'La nota debe estar entre 1.0 y 5.0.';
}

if (!empty($errores)) {
    responder_json(422, [
        'ok' => false,
        'mensaje' => 'Revisa los datos del formulario.',
        'errores' => $errores
    ]);
}

try {
    // Comprueba que el estudiante exista
    $consulta = $conexion->prepare(
        "SELECT id FROM estudiantes WHERE id = :id"
    );
    $consulta->execute([':id' => $estudianteId]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        responder_json(422, [
            'ok' => false,
            'mensaje' => 'El estudiante seleccionado no existe.',
            'errores' => [
                'estudiante_id' => 'Selecciona un estudiante existente.'
            ]
        ]);
    }

    // Comprueba que la materia exista
    $consulta = $conexion->prepare(
        "SELECT id FROM materias WHERE id = :id"
    );
    $consulta->execute([':id' => $materiaId]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        responder_json(422, [
            'ok' => false,
            'mensaje' => 'La materia seleccionada no existe.',
            'errores' => [
                'materia_id' => 'Selecciona una materia existente.'
            ]
        ]);
    }

    // Registra la calificación
    $sql = "INSERT INTO calificaciones (estudiante_id, materia_id, nota)
            VALUES (:estudiante_id, :materia_id, :nota)";

    $consulta = $conexion->prepare($sql);

    $consulta->execute([
        ':estudiante_id' => $estudianteId,
        ':materia_id' => $materiaId,
        ':nota' => (float)$notaTexto
    ]);

    responder_json(201, [
        'ok' => true,
        'mensaje' => 'Calificación registrada correctamente.',
        'calificacion' => [
            'id' => (int)$conexion->lastInsertId(),
            'estudiante_id' => $estudianteId,
            'materia_id' => $materiaId,
            'nota' => (float)$notaTexto
        ]
    ]);

} catch (PDOException $e) {
    error_log('EduControl: error al registrar calificación: ' . $e->getMessage());

    responder_json(500, [
        'ok' => false,
        'mensaje' => 'No fue posible registrar la calificación.'
    ]);
}
