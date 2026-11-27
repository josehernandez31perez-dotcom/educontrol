<?php
// =====================================================================
// EduControl v4 · Tabla de acciones. NO PROBADO.
// Cada acción declara: método HTTP, roles que la pueden invocar, procedimiento (o consulta de solo lectura)
// y sus parámetros con tipo. El router NO confía en el rol de la petición: el rol lo dice la base.
// Tipos: i entero, s texto, d porcentaje, n nota, f fecha, h contraseña (se convierte en hash).
// =====================================================================
declare(strict_types=1);

const V4_ACCIONES = [
    // ---------- ADMIN: cuentas ----------
    'admin.crear_cuenta_profesor' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_cuenta_profesor',
        'args' => ['motivo' => 's', 'nombre_usuario' => 's', 'password' => 'h', 'cedula' => 's', 'nombre' => 's', 'apellido' => 's', 'correo' => 's']],
    'admin.crear_cuenta_alumno' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_cuenta_alumno',
        'args' => ['motivo' => 's', 'estudiante_id' => 'i', 'nombre_usuario' => 's', 'password' => 'h']],
    'admin.crear_cuenta_admin' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_cuenta_admin',
        'args' => ['motivo' => 's', 'nombre_usuario' => 's', 'password' => 'h']],
    'admin.cambiar_estado_cuenta' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_cambiar_estado_cuenta',
        'args' => ['motivo' => 's', 'usuario_id' => 'i', 'estado' => 's']],
    'admin.restablecer_password' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_restablecer_password',
        'args' => ['motivo' => 's', 'usuario_id' => 'i', 'password' => 'h']],
    // ---------- ADMIN: personas ----------
    'admin.crear_estudiante' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_estudiante',
        'args' => ['motivo' => 's', 'cedula' => 's', 'nombre' => 's', 'apellido' => 's']],
    'admin.cambiar_estado_estudiante' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_cambiar_estado_estudiante',
        'args' => ['motivo' => 's', 'estudiante_id' => 'i', 'estado' => 's']],
    'admin.cambiar_estado_profesor' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_cambiar_estado_profesor',
        'args' => ['motivo' => 's', 'profesor_id' => 'i', 'estado' => 's']],
    // ---------- ADMIN: períodos, secciones, asignaciones, inscripciones ----------
    'admin.crear_periodo' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_periodo',
        'args' => ['motivo' => 's', 'anio' => 'i', 'nombre' => 's', 'inicio' => 'f', 'fin' => 'f']],
    'admin.cerrar_periodo' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_cerrar_periodo',
        'args' => ['motivo' => 's', 'periodo_id' => 'i']],
    'admin.reabrir_periodo' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_reabrir_periodo',
        'args' => ['motivo' => 's', 'periodo_id' => 'i']],
    'admin.crear_seccion' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_seccion',
        'args' => ['motivo' => 's', 'materia_id' => 'i', 'periodo_id' => 'i', 'codigo' => 's']],
    'admin.cambiar_estado_seccion' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_cambiar_estado_seccion',
        'args' => ['motivo' => 's', 'seccion_id' => 'i', 'estado' => 's']],
    'admin.asignar_profesor' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_asignar_profesor',
        'args' => ['motivo' => 's', 'profesor_id' => 'i', 'seccion_id' => 'i']],
    'admin.finalizar_asignacion' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_finalizar_asignacion',
        'args' => ['motivo' => 's', 'asignacion_id' => 'i']],
    'admin.inscribir_estudiante' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_inscribir_estudiante',
        'args' => ['motivo' => 's', 'estudiante_id' => 'i', 'seccion_id' => 'i']],
    'admin.finalizar_inscripcion' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_finalizar_inscripcion',
        'args' => ['motivo' => 's', 'inscripcion_id' => 'i']],
    // ---------- ADMIN: evaluaciones, notas, NO APLICA, cierre, pendientes, correcciones ----------
    'admin.crear_evaluacion' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_crear_evaluacion',
        'args' => ['motivo' => 's', 'seccion_id' => 'i', 'nombre' => 's', 'peso' => 'd']],
    'admin.registrar_nota' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_registrar_nota',
        'args' => ['evaluacion_id' => 'i', 'estudiante_id' => 'i', 'nota' => 'n']],
    'admin.marcar_no_aplica' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_marcar_no_aplica',
        'args' => ['motivo' => 's', 'evaluacion_id' => 'i', 'estudiante_id' => 'i']],
    'admin.revocar_no_aplica' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_revocar_no_aplica',
        'args' => ['motivo' => 's', 'no_aplica_id' => 'i']],
    'admin.corregir_nota' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_corregir_nota',
        'args' => ['motivo' => 's', 'evaluacion_id' => 'i', 'estudiante_id' => 'i', 'nueva' => 'n']],
    'admin.clasificar_heredada' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_clasificar_heredada',
        'args' => ['motivo' => 's', 'calificacion_id' => 'i', 'seccion_id' => 'i', 'periodo_id' => 'i']],
    'admin.detectar_pendientes' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_detectar_pendientes',
        'args' => ['periodo_id' => 'i']],
    'admin.resolver_pendiente' => ['m' => 'POST', 'roles' => ['ADMIN'], 'sp' => 'sp_admin_resolver_pendiente',
        'args' => ['motivo' => 's', 'pendiente_id' => 'i', 'resolucion' => 's', 'evaluacion_id' => 'i', 'nota' => 'n']],
    // ---------- PROFESOR ----------
    'prof.mis_secciones' => ['m' => 'GET', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_mis_secciones', 'args' => []],
    'prof.estudiantes_seccion' => ['m' => 'GET', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_estudiantes_seccion',
        'args' => ['seccion_id' => 'i']],
    'prof.calificaciones_seccion' => ['m' => 'GET', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_calificaciones_seccion',
        'args' => ['seccion_id' => 'i']],
    'prof.notas_finales' => ['m' => 'GET', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_notas_finales', 'args' => ['seccion_id' => 'i']],
    'prof.crear_evaluacion' => ['m' => 'POST', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_crear_evaluacion',
        'args' => ['seccion_id' => 'i', 'nombre' => 's', 'peso' => 'd']],
    'prof.registrar_nota' => ['m' => 'POST', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_registrar_nota',
        'args' => ['evaluacion_id' => 'i', 'estudiante_id' => 'i', 'nota' => 'n']],
    'prof.marcar_no_aplica' => ['m' => 'POST', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_marcar_no_aplica',
        'args' => ['evaluacion_id' => 'i', 'estudiante_id' => 'i', 'motivo' => 's']],
    'prof.registrar_observacion' => ['m' => 'POST', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_registrar_observacion',
        'args' => ['estudiante_id' => 'i', 'seccion_id' => 'i', 'texto' => 's']],
    'prof.observaciones_seccion' => ['m' => 'GET', 'roles' => ['PROFESOR'], 'sp' => 'sp_prof_observaciones_seccion',
        'args' => ['seccion_id' => 'i']],
    // ---------- ALUMNO (sin parámetros de identidad: se resuelve en la base desde el token) ----------
    'alum.mis_inscripciones' => ['m' => 'GET', 'roles' => ['ALUMNO'], 'sp' => 'sp_alum_mis_inscripciones', 'args' => []],
    'alum.mis_resultados' => ['m' => 'GET', 'roles' => ['ALUMNO'], 'sp' => 'sp_alum_mis_resultados', 'args' => []],
    'alum.mis_finales' => ['m' => 'GET', 'roles' => ['ALUMNO'], 'sp' => 'sp_alum_mis_finales', 'args' => []],
    'alum.promedios' => ['m' => 'GET', 'roles' => ['ALUMNO'], 'sp' => 'sp_alum_promedios', 'args' => []],
    // ---------- COMÚN ----------
    'comun.mi_perfil' => ['m' => 'GET', 'roles' => ['ADMIN', 'PROFESOR', 'ALUMNO'], 'sp' => 'sp_comun_mi_perfil', 'args' => []],
];

// Lecturas administrativas directas (cuenta admin). Solo ADMIN. Ninguna devuelve contraseñas.
const V4_LECTURAS_ADMIN = [
    'admin.usuarios' => 'SELECT id, nombre_usuario, rol, estado FROM usuarios ORDER BY id',
    'admin.estudiantes' => 'SELECT id, cedula, nombre, apellido, estado, usuario_id FROM estudiantes ORDER BY apellido, nombre',
    'admin.profesores' => 'SELECT id, usuario_id, cedula, nombre, apellido, estado FROM profesores ORDER BY apellido, nombre',
    'admin.materias' => 'SELECT id, nombre, estado FROM materias ORDER BY nombre',
    'admin.periodos' => 'SELECT id, anio_escolar, nombre, fecha_inicio, fecha_fin, estado, fecha_cierre FROM periodos_academicos ORDER BY anio_escolar DESC, id DESC',
    'admin.secciones' => 'SELECT s.id, s.codigo, s.estado, m.nombre AS materia, p.nombre AS periodo, s.materia_id, s.periodo_id FROM secciones s JOIN materias m ON m.id = s.materia_id JOIN periodos_academicos p ON p.id = s.periodo_id ORDER BY p.id DESC, m.nombre, s.codigo',
    'admin.calificaciones' => 'SELECT c.id, c.origen, st.apellido, st.nombre, m.nombre AS materia, p.nombre AS periodo, c.nota FROM calificaciones c JOIN estudiantes st ON st.id = c.estudiante_id JOIN materias m ON m.id = c.materia_id LEFT JOIN periodos_academicos p ON p.id = c.periodo_id ORDER BY c.origen, p.id, st.apellido',
    'admin.pendientes' => 'SELECT id, periodo_id, seccion_id, estudiante_id, tipo, estado, resolucion, fecha_detectado FROM pendientes_calificacion ORDER BY estado, id DESC',
    'admin.auditoria' => 'SELECT a.id, a.fecha, u.nombre_usuario, a.accion, a.entidad, a.entidad_id, a.motivo, a.detalle FROM auditoria_academica a JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT 500',
    'admin.ranking_periodo' => 'SELECT st.id AS estudiante_id, st.apellido, st.nombre, ROUND(AVG(c.nota), 2) AS promedio, COUNT(*) AS materias, ROW_NUMBER() OVER (ORDER BY AVG(c.nota) DESC, st.apellido, st.nombre) AS posicion FROM calificaciones c JOIN estudiantes st ON st.id = c.estudiante_id WHERE c.origen = \'ACTUAL\' AND c.periodo_id = ? GROUP BY st.id, st.apellido, st.nombre',
];
