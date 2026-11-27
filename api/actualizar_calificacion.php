
<?php
// api/actualizar_calificacion.php
require_once __DIR__ . '/bootstrap.php';

requerir_metodo('POST');
requerir_rol('ADMIN');
requerir_csrf();

$datos = leer_json();

$id = filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);

$estudianteId = filter_var(
    $datos['estudiante_id'] ?? null,
    FILTER_VALIDATE_INT
);

$materiaId = filter_var(
    $datos['materia_id'] ?? null,
    FILTER_VALIDATE_INT
);

$notaTexto = trim((string)($datos['nota'] ?? ''));

$errores = [];

if ($id === false || $id === null || $id < 1) {
    $errores['id'] = 'El identificador de la calificación no es válido.';
}

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
    $conexion->beginTransaction();

    // Comprueba que la calificación exista y bloquea su fila.
    $consulta = $conexion->prepare(
        "SELECT id FROM calificaciones WHERE id = :id FOR UPDATE"
    );
    $consulta->execute([':id' => $id]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        $conexion->rollBack();

        responder_json(404, [
            'ok' => false,
            'mensaje' => 'No se encontró la calificación que deseas editar.'
        ]);
    }

    // Comprueba que el estudiante exista.
    $consulta = $conexion->prepare(
        "SELECT id FROM estudiantes WHERE id = :id"
    );
    $consulta->execute([':id' => $estudianteId]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        $conexion->rollBack();

        responder_json(422, [
            'ok' => false,
            'mensaje' => 'El estudiante seleccionado no existe.',
            'errores' => [
                'estudiante_id' => 'Selecciona un estudiante existente.'
            ]
        ]);
    }

    // Comprueba que la materia exista.
    $consulta = $conexion->prepare(
        "SELECT id FROM materias WHERE id = :id"
    );
    $consulta->execute([':id' => $materiaId]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        $conexion->rollBack();

        responder_json(422, [
            'ok' => false,
            'mensaje' => 'La materia seleccionada no existe.',
            'errores' => [
                'materia_id' => 'Selecciona una materia existente.'
            ]
        ]);
    }

    // Actualiza el registro existente, sin crear otro.
    $sql = "UPDATE calificaciones
            SET estudiante_id = :estudiante_id,
                materia_id = :materia_id,
                nota = :nota
            WHERE id = :id";

    $consulta = $conexion->prepare($sql);

    $consulta->execute([
        ':estudiante_id' => $estudianteId,
        ':materia_id' => $materiaId,
        ':nota' => (float)$notaTexto,
        ':id' => $id
    ]);

    $conexion->commit();

    responder_json(200, [
        'ok' => true,
        'mensaje' => 'Calificación actualizada correctamente.',
        'calificacion' => [
            'id' => $id,
            'estudiante_id' => $estudianteId,
            'materia_id' => $materiaId,
            'nota' => (float)$notaTexto
        ]
    ]);

} catch (PDOException $e) {
    if ($conexion->inTransaction()) {
        $conexion->rollBack();
    }

    error_log(
        'EduControl: error al actualizar calificación: ' .
        $e->getMessage()
    );

    responder_json(500, [
        'ok' => false,
        'mensaje' => 'No fue posible actualizar la calificación.'
    ]);
}
