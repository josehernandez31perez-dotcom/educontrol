<?php
require_once "bootstrap.php";
requerir_sesion();

$sql = "SELECT id, nombre, estado FROM materias";

$consulta = $conexion->query($sql);

$materias = $consulta->fetchAll(PDO::FETCH_ASSOC);

header("Content-Type: application/json; charset=utf-8");

echo json_encode($materias, JSON_UNESCAPED_UNICODE);
?>
