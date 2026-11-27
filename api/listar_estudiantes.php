<?php
require_once "bootstrap.php";
requerir_sesion();

$sql = "SELECT id, cedula, nombre, apellido, estado, fecha_registro
        FROM estudiantes";

$consulta = $conexion->query($sql);

$estudiantes = $consulta->fetchAll(PDO::FETCH_ASSOC);

header("Content-Type: application/json; charset=utf-8");

echo json_encode($estudiantes, JSON_UNESCAPED_UNICODE);
?>
