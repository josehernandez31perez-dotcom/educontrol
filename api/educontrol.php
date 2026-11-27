<?php
/* API central EduControl: operaciones persistentes en MySQL. */
require __DIR__ . '/conexion.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? ($input['action'] ?? '');
function respuesta($data, $code=200){ http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
try {
 if ($action === 'get') {
   session_start(); if(!isset($_SESSION['ec_user'])) respuesta(['error'=>'Inicia sesión para consultar los datos'],401);
   $table = $input['table'] ?? '';
   $map = ['estudiantes'=>'estudiantes','materias'=>'materias','calificaciones'=>'calificaciones','usuarios'=>'usuarios'];
   if (!isset($map[$table])) respuesta(['error'=>'Tabla no permitida'],400);
   $rows=$conexion->query('SELECT * FROM '.$map[$table])->fetchAll(PDO::FETCH_ASSOC);
   if ($table==='usuarios') foreach($rows as &$r){ unset($r['password_hash']); } unset($r);
   respuesta(['ok'=>true,'data'=>$rows]);
 }
 if ($action === 'save') {
   session_start(); if(($_SESSION['ec_role']??'')!=='ADMIN') respuesta(['error'=>'Acceso restringido al administrador'],403);
   $table=$input['table']??''; $rows=$input['data']??[];
   if (!is_array($rows)) respuesta(['error'=>'Datos inválidos'],400);
   $conexion->beginTransaction();
   if ($table==='estudiantes') {
    foreach($rows as $r){ $stmt=$conexion->prepare('INSERT INTO estudiantes(id,cedula,nombre,apellido,estado) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE cedula=VALUES(cedula),nombre=VALUES(nombre),apellido=VALUES(apellido),estado=VALUES(estado)'); $stmt->execute([$r['id']??null,$r['cedula'],$r['nombre'],$r['apellido'],$r['estado']??'ACTIVO']); }
    $ids=array_column($rows,'id'); if($ids){$in=implode(',',array_fill(0,count($ids),'?'));$conexion->prepare("DELETE FROM estudiantes WHERE id NOT IN ($in)")->execute($ids);} else {$conexion->exec('DELETE FROM estudiantes');}
   } elseif($table==='materias') {
    foreach($rows as $r){$s=$conexion->prepare('INSERT INTO materias(id,nombre,estado) VALUES(?,?,?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),estado=VALUES(estado)');$s->execute([$r['id']??null,$r['nombre'],$r['estado']??'ACTIVA']);}
   } elseif($table==='calificaciones') {
    foreach($rows as $r){$s=$conexion->prepare('INSERT INTO calificaciones(id,estudiante_id,materia_id,nota) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE estudiante_id=VALUES(estudiante_id),materia_id=VALUES(materia_id),nota=VALUES(nota)');$s->execute([$r['id']??null,$r['estudiante_id'],$r['materia_id'],$r['nota']]);}
    $ids=array_column($rows,'id'); if($ids){$in=implode(',',array_fill(0,count($ids),'?'));$conexion->prepare("DELETE FROM calificaciones WHERE id NOT IN ($in)")->execute($ids);} else {$conexion->exec('DELETE FROM calificaciones');}
   } else {respuesta(['error'=>'Tabla no autorizada'],400);}
   $conexion->commit(); respuesta(['ok'=>true]);
 }
 if ($action==='config_get') { $r=$conexion->query('SELECT nota_minima,nota_maxima,nota_aprobacion FROM configuracion_academica WHERE id=1')->fetch(PDO::FETCH_ASSOC); respuesta(['ok'=>true,'data'=>['notaMinima'=>(float)$r['nota_minima'],'notaMaxima'=>(float)$r['nota_maxima'],'notaAprobacion'=>(float)$r['nota_aprobacion']]]); }
 if ($action==='config_save') { session_start(); if(($_SESSION['ec_role']??'')!=='ADMIN') respuesta(['error'=>'Acceso restringido al administrador'],403); $d=$input['data']; $s=$conexion->prepare('UPDATE configuracion_academica SET nota_minima=?,nota_maxima=?,nota_aprobacion=? WHERE id=1');$s->execute([$d['notaMinima'],$d['notaMaxima'],$d['notaAprobacion']]);respuesta(['ok'=>true]); }
 if ($action==='login') { $s=$conexion->prepare('SELECT nombre_usuario,password_hash,rol,activo FROM usuarios WHERE nombre_usuario=?');$s->execute([$input['usuario']??'']);$u=$s->fetch(PDO::FETCH_ASSOC); if($u && $u['activo'] && hash('sha256',$input['clave']??'')===$u['password_hash']){session_start();$_SESSION['ec_user']=$u['nombre_usuario'];$_SESSION['ec_role']=$u['rol'];respuesta(['ok'=>true,'usuario'=>$u['nombre_usuario'],'rol'=>$u['rol']]);}respuesta(['ok'=>false]); }
 if ($action==='logout'){session_start();session_destroy();respuesta(['ok'=>true]);}
 respuesta(['error'=>'Acción desconocida'],400);
} catch(Throwable $e){if($conexion->inTransaction())$conexion->rollBack();respuesta(['error'=>'Error procesando la solicitud. Verifica datos y relaciones.','detail'=>$e->getMessage()],500);}
