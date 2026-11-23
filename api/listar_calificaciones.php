<?php
require_once "conexion.php";

$sql = "SELECT
            c.id,
            e.nombre AS estudiante,
            e.apellido,
            m.nombre AS materia,
            c.nota,
            c.fecha_registro
        FROM calificaciones c
        INNER JOIN estudiantes e
            ON c.estudiante_id = e.id
        INNER JOIN materias m
            ON c.materia_id = m.id
        ORDER BY e.nombre, m.nombre";

$consulta = $conexion->query($sql);

$calificaciones = $consulta->fetchAll(PDO::FETCH_ASSOC);

header("Content-Type: application/json; charset=utf-8");

echo json_encode($calificaciones, JSON_UNESCAPED_UNICODE);
?>
