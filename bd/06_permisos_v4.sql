-- =====================================================================
-- EduControl · Etapa E · 06_permisos_v4.sql
-- Cuentas y privilegios. ESCRITO, NO EJECUTADO. NO PROBADO EN MARIADB 10.4.32.
-- Lo ejecuta UN administrador del servidor (root) UNA VEZ, en la base de PRUEBA primero.
-- Las contraseñas se generan fuera de este archivo y nunca se guardan en el repositorio.
-- =====================================================================
SELECT DATABASE() AS base_activa;

-- Cuenta del propietario de los procedimientos: BLOQUEADA, nadie inicia sesión con ella.
CREATE USER 'educontrol_definer'@'localhost' IDENTIFIED BY '<GENERADA_NO_USAR>' ACCOUNT LOCK;  -- [NO PROBADO]
CREATE USER 'educontrol_login'@'localhost'   IDENTIFIED BY '<GENERADA>';
CREATE USER 'educontrol_app'@'localhost'     IDENTIFIED BY '<GENERADA>';
CREATE USER 'educontrol_admin'@'localhost'   IDENTIFIED BY '<GENERADA>';
CREATE USER 'educontrol_migra'@'localhost'   IDENTIFIED BY '<GENERADA>';

-- ----- Propietario (definer): lo que necesitan los procedimientos. Sin DELETE. Sin DDL. Sin GRANT. -----
GRANT SELECT ON educontrol.* TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.usuarios TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.profesores TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.estudiantes TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.periodos_academicos TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.secciones TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.profesor_seccion TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.estudiante_seccion TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.calificaciones TO 'educontrol_definer'@'localhost';
GRANT INSERT ON educontrol.auditoria_academica TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.evaluaciones TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.notas_evaluacion TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.evaluacion_no_aplica TO 'educontrol_definer'@'localhost';
GRANT INSERT, UPDATE ON educontrol.pendientes_calificacion TO 'educontrol_definer'@'localhost';
GRANT INSERT ON educontrol.observaciones TO 'educontrol_definer'@'localhost';
GRANT INSERT ON educontrol.sesiones_app TO 'educontrol_definer'@'localhost';
GRANT UPDATE (revocada) ON educontrol.sesiones_app TO 'educontrol_definer'@'localhost';

-- ----- Login: única cuenta con acceso a contraseñas, y única que crea sesiones. -----
GRANT SELECT (id, nombre_usuario, password, rol, estado) ON educontrol.usuarios TO 'educontrol_login'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_sesion_crear TO 'educontrol_login'@'localhost';

-- ----- Aplicación (PROFESOR y ALUMNO): solo procedimientos. Sin tablas directas. -----
GRANT EXECUTE ON PROCEDURE educontrol.sp_sesion_contexto TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_sesion_revocar TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_comun_mi_perfil TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_mis_secciones TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_estudiantes_seccion TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_calificaciones_seccion TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_notas_finales TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_crear_evaluacion TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_registrar_nota TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_marcar_no_aplica TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_registrar_observacion TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_prof_observaciones_seccion TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_alum_mis_inscripciones TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_alum_mis_resultados TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_alum_mis_finales TO 'educontrol_app'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_alum_promedios TO 'educontrol_app'@'localhost';

-- ----- Administración (ADMIN): sus procedimientos y lectura directa para listados. Sin INSERT/UPDATE directos. -----
GRANT EXECUTE ON PROCEDURE educontrol.sp_sesion_contexto TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_sesion_revocar TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_comun_mi_perfil TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_cuenta_profesor TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_cuenta_alumno TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_cuenta_admin TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cambiar_estado_cuenta TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cambiar_rol_cuenta TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_restablecer_password TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_estudiante TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cambiar_estado_estudiante TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cambiar_estado_profesor TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_periodo TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cerrar_periodo TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_reabrir_periodo TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_seccion TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_cambiar_estado_seccion TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_asignar_profesor TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_finalizar_asignacion TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_inscribir_estudiante TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_finalizar_inscripcion TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_crear_evaluacion TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_registrar_nota TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_marcar_no_aplica TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_revocar_no_aplica TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_corregir_nota TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_clasificar_heredada TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_detectar_pendientes TO 'educontrol_admin'@'localhost';
GRANT EXECUTE ON PROCEDURE educontrol.sp_admin_resolver_pendiente TO 'educontrol_admin'@'localhost';
-- Lectura administrativa (listados y reportes). Sin password de usuarios.
GRANT SELECT (id, nombre_usuario, rol, estado) ON educontrol.usuarios TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.estudiantes TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.profesores TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.materias TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.periodos_academicos TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.secciones TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.profesor_seccion TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.estudiante_seccion TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.calificaciones TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.evaluaciones TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.notas_evaluacion TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.evaluacion_no_aplica TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.pendientes_calificacion TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.observaciones TO 'educontrol_admin'@'localhost';
GRANT SELECT ON educontrol.auditoria_academica TO 'educontrol_admin'@'localhost';

-- ----- Migración (manual, consola). Nunca lo usa PHP. -----
GRANT ALL PRIVILEGES ON educontrol.* TO 'educontrol_migra'@'localhost';

-- Comprobación posterior (solo lectura): SHOW GRANTS FOR 'educontrol_app'@'localhost';  y las demás cuentas.
-- Denegado por diseño a app, admin y login: DELETE en cualquier tabla; INSERT/UPDATE directos sobre tablas de negocio;
-- CREATE, ALTER, DROP, INDEX, TRIGGER, EVENT, GRANT OPTION; acceso a otras bases de datos; EXECUTE de sp_interno_*.
