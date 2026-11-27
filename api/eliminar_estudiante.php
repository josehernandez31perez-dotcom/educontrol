
<?php
// api/eliminar_estudiante.php
require_once __DIR__ . '/bootstrap.php';

// Seguridad
requerir_metodo('POST');
requerir_rol('ADMIN');
requerir_csrf();

// Recibir identificador
$datos = leer_json();
$id = filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);

if ($id === false || $id === null || $id < 1) {
    responder_json(422, [
        'ok' => false,
        'mensaje' => 'El identificador del estudiante no es válido.'
    ]);
}

try {
    $conexion->beginTransaction();

    // Comprobar que existe y bloquear el registro durante la operación
    $consulta = $conexion->prepare(
        "SELECT id FROM estudiantes WHERE id = :id FOR UPDATE"
    );
    $consulta->execute(['id' => $id]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        $conexion->rollBack();

        responder_json(404, [
            'ok' => false,
            'mensaje' => 'No se encontró el estudiante.'
        ]);
    }

    // Comprobar si tiene calificaciones
    $consulta = $conexion->prepare(
        "SELECT COUNT(*) FROM calificaciones WHERE estudiante_id = :id"
    );
    $consulta->execute(['id' => $id]);
    $cantidad = (int) $consulta->fetchColumn();

    if ($cantidad > 0) {
        $conexion->rollBack();

        responder_json(409, [
            'ok' => false,
            'mensaje' => 'No se puede eliminar este estudiante porque tiene ' .
                $cantidad . ' calificación(es) registrada(s).'
        ]);
    }

    // Eliminar únicamente si no tiene calificaciones
    $consulta = $conexion->prepare(
        "DELETE FROM estudiantes WHERE id = :id"
    );
    $consulta->execute(['id' => $id]);

    $conexion->commit();

    responder_json(200, [
        'ok' => true,
        'mensaje' => 'Estudiante eliminado correctamente.'
    ]);

} catch (PDOException $e) {
    if ($conexion->inTransaction()) {
        $conexion->rollBack();
    }

    error_log('EduControl: error al eliminar estudiante: ' . $e->getMessage());

    responder_json(500, [
        'ok' => false,
        'mensaje' => 'No fue posible eliminar el estudiante.'
    ]);
}
