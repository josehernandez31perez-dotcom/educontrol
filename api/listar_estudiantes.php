<?php
require_once "conexion.php";

$sql = "SELECT id, cedula, nombre, apellido, estado
        FROM estudiantes";

$consulta = $conexion->query($sql);

$estudiantes = $consulta->fetchAll(PDO::FETCH_ASSOC);

header("Content-Type: application/json; charset=utf-8");

echo json_encode($estudiantes, JSON_UNESCAPED_UNICODE);
?>