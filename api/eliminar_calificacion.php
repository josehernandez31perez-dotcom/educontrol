
<?php
// api/eliminar_calificacion.php
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
        'mensaje' => 'El identificador de la calificación no es válido.'
    ]);
}

try {
    $conexion->beginTransaction();

    // Comprobar que existe y bloquear el registro
    $consulta = $conexion->prepare(
        "SELECT id FROM calificaciones WHERE id = :id FOR UPDATE"
    );
    $consulta->execute(['id' => $id]);

    if (!$consulta->fetch(PDO::FETCH_ASSOC)) {
        $conexion->rollBack();

        responder_json(404, [
            'ok' => false,
            'mensaje' => 'No se encontró la calificación.'
        ]);
    }

    // Eliminar únicamente la calificación seleccionada
    $consulta = $conexion->prepare(
        "DELETE FROM calificaciones WHERE id = :id"
    );
    $consulta->execute(['id' => $id]);

    $conexion->commit();

    responder_json(200, [
        'ok' => true,
        'mensaje' => 'Calificación eliminada correctamente.'
    ]);

} catch (PDOException $e) {
    if ($conexion->inTransaction()) {
        $conexion->rollBack();
    }

    error_log('EduControl: error al eliminar calificación: ' . $e->getMessage());

    responder_json(500, [
        'ok' => false,
        'mensaje' => 'No fue posible eliminar la calificación.'
    ]);
}
