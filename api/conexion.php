<?php
$host = "localhost";
$usuario = "root";
$password = "";
$base_datos = "educontrol";

try {
    $conexion = new PDO(
        "mysql:host=$host;dbname=$base_datos;charset=utf8mb4",
        $usuario,
        $password
    );

    $conexion->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
    http_response_code(500);
    die("Error de conexión con la base de datos.");
}
?>